import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isSameOrigin } from '@/lib/admin/policy';
import { recordUserActivity } from '@/lib/userActivity';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: '请求来源无效' }, { status: 403, headers });
  try {
    const { data: { user }, error } = await (await createClient()).auth.getUser();
    if (error || !user) return NextResponse.json({ error: '未登录' }, { status: 401, headers });
    // No client-supplied account IDs, dates, or counters are accepted.
    const saved = await recordUserActivity(user.id);
    return NextResponse.json({ recorded: saved }, { status: saved ? 200 : 503, headers });
  } catch {
    return NextResponse.json({ recorded: false }, { status: 503, headers });
  }
}
