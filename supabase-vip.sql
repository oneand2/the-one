-- VIP 功能：在 user_profiles 上增加 vip_expires_at
-- 在 Supabase SQL Editor 中执行

alter table user_profiles
  add column if not exists vip_expires_at timestamptz default null;

comment on column user_profiles.vip_expires_at is 'VIP 到期时间，null 表示终身 VIP';
