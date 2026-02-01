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

-- 邀请奖励：用安全函数在数据库内完成增币，避免依赖 service role key
create or replace function apply_invite_reward(p_invite_code text, p_new_user_id uuid, p_reward int default 200)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter_id uuid;
begin
  if p_invite_code is null or length(trim(p_invite_code)) = 0 then
    return false;
  end if;

  select user_id into v_inviter_id
  from user_profiles
  where invite_code = trim(upper(p_invite_code))
  limit 1;

  if not found then
    return false;
  end if;

  if v_inviter_id = p_new_user_id then
    return false;
  end if;

  update user_profiles
  set coins_balance = coins_balance + p_reward
  where user_id = v_inviter_id;

  return true;
end;
$$;

grant execute on function apply_invite_reward(text, uuid, int) to authenticated;
