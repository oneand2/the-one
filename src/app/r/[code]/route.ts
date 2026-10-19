import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { canonicalSiteRequest, CODE_PATTERN, REFERRAL_COOKIE } from '@/lib/ambassadors/shared';
import { referralCookie, resolveReferralVisit } from '@/lib/ambassadors/referral';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!CODE_PATTERN.test(code)) return new NextResponse('推广链接无效', { status: 404 });
  const canonical = canonicalSiteRequest(request.url, process.env.NEXT_PUBLIC_SITE_URL);
  if (canonical) return NextResponse.redirect(canonical);
  try {
    const admin = createAdminClient();
    // Check the requested link even when another first-touch visit already exists.
    const { data, error } = await admin.from('ambassadors').select('id').eq('code', code).eq('active', true).maybeSingle();
    if (error) throw error;
    if (!data) return new NextResponse('推广链接已暂停或不存在，请联系分享者。', { status: 404 });
    const visit = await resolveReferralVisit(admin, request.cookies.get(REFERRAL_COOKIE)?.value, code);
    if (!visit) throw new Error('推广来源暂时无法保存');
    // Opening this resulting URL in Safari or forwarding it retains the public source.
    const destination = new URL('/', process.env.NEXT_PUBLIC_SITE_URL || request.url);
    destination.searchParams.set('ref', visit.code);
    const response = NextResponse.redirect(destination);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.cookies.set(referralCookie(visit, destination.protocol === 'https:'));
    return response;
  } catch {
    return new NextResponse('推广链接暂时无法打开，请稍后重试。', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
