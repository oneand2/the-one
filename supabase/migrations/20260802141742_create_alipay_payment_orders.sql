-- 支付宝电脑网站支付订单。
-- 订单只能由服务端创建和入账；登录用户仅能读取自己的订单状态。

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  out_trade_no text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null,
  subject text not null,
  coins integer not null check (coins > 0),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'closed', 'refunded')),
  alipay_trade_no text unique,
  paid_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_orders_user_created_idx
  on public.payment_orders (user_id, created_at desc);

create index if not exists payment_orders_pending_idx
  on public.payment_orders (created_at)
  where status = 'pending';

alter table public.payment_orders enable row level security;

revoke all on table public.payment_orders from anon, authenticated;
grant select on table public.payment_orders to authenticated;
grant select, insert, update, delete on table public.payment_orders to service_role;

drop policy if exists "users_read_own_payment_orders" on public.payment_orders;
create policy "users_read_own_payment_orders"
  on public.payment_orders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 在同一事务中标记订单成功并增加铜币，保证支付宝重复通知不会重复入账。
create or replace function public.credit_alipay_order(
  p_out_trade_no text,
  p_alipay_trade_no text,
  p_amount_cents integer
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.payment_orders%rowtype;
begin
  select *
  into v_order
  from public.payment_orders
  where out_trade_no = p_out_trade_no
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_order.amount_cents <> p_amount_cents then
    return 'amount_mismatch';
  end if;

  if v_order.credited_at is not null then
    if v_order.alipay_trade_no = p_alipay_trade_no then
      return 'already_credited';
    end if;
    return 'trade_mismatch';
  end if;

  if exists (
    select 1
    from public.payment_orders
    where alipay_trade_no = p_alipay_trade_no
      and out_trade_no <> p_out_trade_no
  ) then
    return 'trade_mismatch';
  end if;

  insert into public.user_profiles (user_id, coins_balance)
  values (v_order.user_id, v_order.coins)
  on conflict (user_id) do update
  set coins_balance = public.user_profiles.coins_balance + excluded.coins_balance;

  update public.payment_orders
  set status = 'paid',
      alipay_trade_no = p_alipay_trade_no,
      paid_at = coalesce(paid_at, now()),
      credited_at = now(),
      updated_at = now()
  where id = v_order.id;

  return 'credited';
end;
$$;

revoke all on function public.credit_alipay_order(text, text, integer) from public, anon, authenticated;
grant execute on function public.credit_alipay_order(text, text, integer) to service_role;

-- 保留历史兑换数据以便审计或回退，但关闭所有旧兑换入口与函数权限。
do $$
begin
  if to_regclass('public.redemption_codes') is not null then
    execute 'drop policy if exists "authenticated_read_redemption_codes" on public.redemption_codes';
    execute 'revoke all on table public.redemption_codes from public, anon, authenticated';
  end if;
  if to_regprocedure('public.redeem_code(text,uuid)') is not null then
    execute 'revoke all on function public.redeem_code(text, uuid) from public, anon, authenticated, service_role';
  end if;
end;
$$;
