-- 用户档案表：昵称、铜币余额、邀请码（与 auth.users 对应）
-- 在 Supabase SQL Editor 中执行

create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text default '',
  coins_balance int not null default 50,
  invite_code text unique
);

create index if not exists idx_user_profiles_invite_code on user_profiles(invite_code) where invite_code is not null;

alter table user_profiles enable row level security;

create policy "用户仅能读写自己的档案"
  on user_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 服务端扣币、给邀请人加币需在 API 中用 service role 或单独 policy
-- 若仅用 anon key，需允许：当前用户 update 自己的 coins_balance（减少）、
-- 且「被邀请人注册时」给邀请人加 200 需在 callback 里用 service role 完成（见应用代码）。
