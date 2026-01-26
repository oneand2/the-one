-- 兑换码表：用于「兑换码充值」功能
-- 在 Supabase SQL Editor 中执行

create table if not exists redemption_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  coins int not null check (coins > 0),
  is_used boolean not null default false,
  used_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_redemption_codes_code on redemption_codes(code);
create index if not exists idx_redemption_codes_is_used on redemption_codes(is_used) where is_used = false;

alter table redemption_codes enable row level security;

-- 只开放读权限：已登录用户可读（用于后台查询/统计）；写操作由后端 API 用 Service Role 完成
create policy "authenticated_read_redemption_codes"
  on redemption_codes for select
  to authenticated
  using (true);

-- 兑换逻辑放在 DB 函数中，由 Service Role 在 API 里调用，保证事务
create or replace function redeem_code(p_code text, p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins int;
begin
  select coins into v_coins
  from redemption_codes
  where code = p_code and is_used = false
  for update;

  if not found then
    raise exception 'INVALID_OR_USED';
  end if;

  update redemption_codes
  set is_used = true, used_by = p_user_id
  where code = p_code;

  insert into user_profiles (user_id, coins_balance)
  values (p_user_id, v_coins)
  on conflict (user_id) do update
  set coins_balance = user_profiles.coins_balance + v_coins;

  return v_coins;
end;
$$;

grant execute on function redeem_code(text, uuid) to service_role;
