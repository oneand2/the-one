import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { CODE_PATTERN, REFERRAL_COOKIE, REFERRAL_DAYS } from '@/lib/ambassadors/shared';
import { validReferralToken } from '@/lib/ambassadors/server';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!CODE_PATTERN.test(code)) return new NextResponse('推广链接无效', { status: 404 });
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from('ambassadors').select('id').eq('code', code).eq('active', true).maybeSingle();
    if (error) throw error;
    if (!data) return new NextResponse('推广链接已暂停或不存在，请联系分享者。', { status: 404 });
    const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || request.url));
    response.headers.set('Cache-Control', 'private, no-store');
    // First valid visit wins; revisiting never extends the original expiry.
    if (await validReferralToken(admin, request.cookies.get(REFERRAL_COOKIE)?.value)) return response;
    const visit = await admin.from('ambassador_visits').insert({ ambassador_id: data.id }).select('token').single();
    if (visit.error) throw visit.error;
    response.cookies.set(REFERRAL_COOKIE, visit.data.token, { httpOnly: true, secure: new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: REFERRAL_DAYS * 86400 });
    return response;
  } catch {
    return new NextResponse('推广链接暂时无法打开，请稍后重试。', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
