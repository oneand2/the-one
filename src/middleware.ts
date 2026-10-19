import { referralCookie, resolveReferralVisit, type ReferralVisit } from '@/lib/ambassadors/referral';
import { canonicalSiteRequest, referralCode, REFERRAL_COOKIE } from '@/lib/ambassadors/shared';
import { createAdminClient } from '@/utils/supabase/admin';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const canonical = canonicalSiteRequest(request.url, process.env.NEXT_PUBLIC_SITE_URL, request.headers.get('host'));
  if (canonical && ['GET', 'HEAD'].includes(request.method)) return NextResponse.redirect(canonical);

  let referral: ReferralVisit | undefined;
  const code = referralCode(request.nextUrl.searchParams.get('ref'));
  if (request.method === 'GET' && code && !request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/r/')) {
    try {
      referral = await resolveReferralVisit(createAdminClient(), request.cookies.get(REFERRAL_COOKIE)?.value, code);
      if (referral) request.cookies.set(REFERRAL_COOKIE, referral.token);
    } catch {
      return new NextResponse('推广来源暂时无法确认，请刷新重试。', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }
  function withReferral(response: NextResponse) {
    if (referral) {
      response.cookies.set(referralCookie(referral, new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).protocol === 'https:'));
      response.headers.set('Cache-Control', 'private, no-store');
    }
    return response;
  }

  // APK 暂停公开分发；历史文件即使仍存在于旧镜像中也不可下载。
  if (request.nextUrl.pathname === '/app-release.apk') {
    return new NextResponse(null, { status: 410 });
  }

  // iOS 嵌入页由原生壳负责登录态；这里跳过 getUser，避免代理超时把首页拖成空白。
  if (request.nextUrl.searchParams.get('embed') === 'ios') {
    return withReferral(NextResponse.next({ request }));
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return withReferral(supabaseResponse);
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 刷新 session；网络不稳定（如部分 Wi-Fi）时加超时，避免整页卡死或“已丢失网络连接”
  const AUTH_TIMEOUT_MS = 8000;
  let user: { id: string } | null = null;
  let authKnown = false; // 是否已拿到明确的鉴权结果（未超时、未报错）
  try {
    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('auth_timeout')), AUTH_TIMEOUT_MS)
      ),
    ]);
    user = authResult?.data?.user ?? null;
    authKnown = true;
  } catch {
    // 超时或网络错误：放行请求，不当作“未登录”；受保护页会在客户端再次校验
    user = null;
    authKnown = false;
  }

  // 定义需要登录才能访问的路径
  const protectedPaths = ['/profile', '/history', '/my'];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // 仅当「确定未登录」时才跳转登录；鉴权超时/失败时放行，由受保护页在客户端用 cookie 再校验
  if (isProtectedPath && authKnown && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return withReferral(NextResponse.redirect(url));
  }

  return withReferral(supabaseResponse);
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (favicon)
     * - 常用图片文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
