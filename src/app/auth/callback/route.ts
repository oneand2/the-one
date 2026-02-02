import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { cookies } from 'next/headers';

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
    const cookieStore = await cookies();
    
    // 创建一个响应对象，用于正确设置 cookies
    let response = NextResponse.redirect(`${origin}${next}`);

    // 使用 createServerClient 并正确处理 cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // 将 cookies 设置到响应中
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
            // 同时也设置到 cookieStore 中
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (e) {
              // 在某些情况下可能会失败，但响应中的 cookies 是最重要的
            }
          },
        },
      }
    );
    
    // exchangeCodeForSession 会自动通过上面的 setAll 设置 session cookies
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const uid = data.user.id;
      const meta = data.user.user_metadata || {};
      const nickname = (meta.nickname as string)?.trim()?.slice(0, 50) ?? '';
      const inviteCodeFromMeta = (meta.invite_code as string)?.trim()?.toUpperCase();
      const inviteCodeFromQuery = requestUrl.searchParams.get('inviteCode')?.trim()?.toUpperCase();
      const inviteCode = inviteCodeFromMeta || inviteCodeFromQuery;

      const { error: insertErr } = await supabase
        .from(PROFILE_TABLE)
        .upsert(
          { user_id: uid, nickname, coins_balance: INITIAL_COINS },
          { onConflict: 'user_id', ignoreDuplicates: true },
        );

      if (!insertErr && inviteCode) {
        try {
          const { data: rewardOk, error: rewardErr } = await supabase.rpc('apply_invite_reward', {
            p_invite_code: inviteCode,
            p_new_user_id: uid,
            p_reward: INVITE_REWARD,
          });
          if (rewardErr) {
            console.error('Invite reward: rpc failed, will try admin fallback', rewardErr);
          } else if (!rewardOk) {
            console.warn('Invite reward: rpc returned false (invalid code or self-invite)');
          }

          if (rewardErr) {
            const admin = createAdminClient();
            const { data: inviter, error: inviterErr } = await admin
              .from(PROFILE_TABLE)
              .select('user_id, coins_balance')
              .eq('invite_code', inviteCode)
              .single();
            if (inviterErr) {
              console.error('Invite reward: failed to find inviter', inviterErr);
            } else if (inviter) {
              const inviterId = (inviter as { user_id: string }).user_id;
              if (inviterId === uid) {
                console.warn('Invite reward: self-invite ignored');
              } else {
                const cur = (inviter as { coins_balance?: number }).coins_balance ?? 0;
                const { error: updateErr } = await admin
                  .from(PROFILE_TABLE)
                  .update({ coins_balance: cur + INVITE_REWARD })
                  .eq('user_id', inviterId);
                if (updateErr) {
                  console.error('Invite reward: failed to update inviter coins', updateErr);
                }
              }
            }
          }
        } catch (err) {
          console.error('Invite reward: unexpected error', err);
        }
      }
      
      // 返回已经设置好 cookies 的重定向响应
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?message=验证失败，请重试&next=${encodeURIComponent(next)}`);
}
