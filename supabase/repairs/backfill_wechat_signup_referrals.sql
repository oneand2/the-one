-- One-off, idempotent repair for the pre-fix WeChat createUser metadata timing.
-- Run as database administrator, never expose as an RPC. Preserve original
-- signup dates; do not reassign an existing referral or attach old accounts.
-- Require both server-owned signup metadata and a matching authorized ticket
-- that existed before the account and was valid when the account was created.
with repaired as (
  insert into public.user_referrals(user_id, ambassador_id, created_at)
  select u.id, v.ambassador_id, u.created_at
  from auth.users u
  join public.ambassador_visits v
    on v.token::text = u.raw_app_meta_data->>'ambassador_token'
  join public.ambassadors a on a.id = v.ambassador_id
  where u.raw_app_meta_data->>'signup_source' = 'wechat'
    and a.active and a.user_id <> u.id
    and v.created_at <= u.created_at and u.created_at < v.expires_at
    and exists (
      select 1 from public.wechat_login_tickets t
      where t.user_id = u.id and t.ambassador_token = v.token
        and t.mode = 'login' and t.status in ('authorized', 'consumed')
        and t.created_at <= u.created_at and u.created_at < t.expires_at
    )
  on conflict (user_id) do nothing
  returning user_id
)
select count(*) as repaired_users from repaired;
