import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

const PROFILE_TABLE = 'user_profiles';
const INITIAL_COINS = 50;
const INVITE_REWARD = 200;

/**
 * Auth Callback 路由
 * 处理 Supabase 邮箱验证链接跳转，并为新用户建档案、处理邀请奖励
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const uid = data.user.id;
      const meta = data.user.user_metadata || {};
      const nickname = (meta.nickname as string)?.trim()?.slice(0, 50) ?? '';
      const inviteCode = (meta.invite_code as string)?.trim()?.toUpperCase();

      const { error: insertErr } = await supabase
        .from(PROFILE_TABLE)
        .upsert({ user_id: uid, nickname, coins_balance: INITIAL_COINS }, { onConflict: 'user_id' });

      if (!insertErr && inviteCode) {
        try {
          const admin = createAdminClient();
          const { data: inviter, error: inviterErr } = await admin
            .from(PROFILE_TABLE)
            .select('user_id, coins_balance')
            .eq('invite_code', inviteCode)
            .single();
          if (inviterErr) {
            console.error('Invite reward: failed to find inviter', inviterErr);
          } else if (inviter) {
            const cur = (inviter as { coins_balance?: number }).coins_balance ?? 0;
            const { error: updateErr } = await admin
              .from(PROFILE_TABLE)
              .update({ coins_balance: cur + INVITE_REWARD })
              .eq('user_id', (inviter as { user_id: string }).user_id);
            if (updateErr) {
              console.error('Invite reward: failed to update inviter coins', updateErr);
            }
          }
        } catch (err) {
          console.error('Invite reward: unexpected error', err);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?message=验证失败，请重试&next=${encodeURIComponent(next)}`);
}
