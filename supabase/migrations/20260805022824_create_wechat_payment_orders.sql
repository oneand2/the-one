-- 微信 Native 扫码支付订单。订单只由服务端创建和入账；用户只能读取自己的订单。

create table if not exists public.wechat_payment_orders (
  id uuid primary key default gen_random_uuid(),
  out_trade_no text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null,
  subject text not null,
  coins integer not null check (coins > 0),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'closed', 'refunded')),
  wechat_transaction_id text unique,
  paid_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wechat_payment_orders_user_created_idx
  on public.wechat_payment_orders (user_id, created_at desc);

create index if not exists wechat_payment_orders_pending_idx
  on public.wechat_payment_orders (created_at)
  where status = 'pending';

alter table public.wechat_payment_orders enable row level security;

revoke all on table public.wechat_payment_orders from public, anon, authenticated;
grant select on table public.wechat_payment_orders to authenticated;
grant select, insert, update, delete on table public.wechat_payment_orders to service_role;

drop policy if exists "users_read_own_wechat_payment_orders" on public.wechat_payment_orders;
create policy "users_read_own_wechat_payment_orders"
  on public.wechat_payment_orders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 原子地标记订单成功并增加铜币，保证重复回调或主动查单不会重复入账。
create or replace function public.credit_wechat_order(
  p_out_trade_no text,
  p_transaction_id text,
  p_amount_cents integer
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.wechat_payment_orders%rowtype;
begin
  select *
  into v_order
  from public.wechat_payment_orders
  where out_trade_no = p_out_trade_no
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_order.amount_cents <> p_amount_cents then
    return 'amount_mismatch';
  end if;

  if p_transaction_id is null
    or p_transaction_id !~ '^[0-9]{20,64}$'
    or p_amount_cents is null
    or p_amount_cents <= 0 then
    return 'invalid_parameters';
  end if;

  if v_order.credited_at is not null then
    if v_order.wechat_transaction_id = p_transaction_id then
      return 'already_credited';
    end if;
    return 'trade_mismatch';
  end if;

  if v_order.status <> 'pending' then
    return 'invalid_status';
  end if;

  if exists (
    select 1
    from public.wechat_payment_orders
    where wechat_transaction_id = p_transaction_id
      and out_trade_no <> p_out_trade_no
  ) then
    return 'trade_mismatch';
  end if;

  insert into public.user_profiles (user_id, coins_balance)
  values (v_order.user_id, v_order.coins)
  on conflict (user_id) do update
  set coins_balance = public.user_profiles.coins_balance + excluded.coins_balance;

  update public.wechat_payment_orders
  set status = 'paid',
      wechat_transaction_id = p_transaction_id,
      paid_at = coalesce(paid_at, now()),
      credited_at = now(),
      updated_at = now()
  where id = v_order.id;

  return 'credited';
end;
$$;

revoke all on function public.credit_wechat_order(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.credit_wechat_order(text, text, integer)
  to service_role;
