-- 终身 VIP 可购买入账。请在 Supabase SQL Editor 执行一次。
-- 与 supabase/migrations/20260825173000_lifetime_vip_purchases.sql 内容一致。

alter table public.payment_orders
  drop constraint if exists payment_orders_coins_check;
alter table public.payment_orders
  add constraint payment_orders_coins_check check (coins >= 0);

alter table public.wechat_payment_orders
  drop constraint if exists wechat_payment_orders_coins_check;
alter table public.wechat_payment_orders
  add constraint wechat_payment_orders_coins_check check (coins >= 0);

alter table public.apple_iap_transactions
  drop constraint if exists apple_iap_transactions_coins_check;
alter table public.apple_iap_transactions
  add constraint apple_iap_transactions_coins_check check (coins >= 0);

create or replace function public.grant_lifetime_vip(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles (user_id, nickname, coins_balance, vip_expires_at)
  values (p_user_id, '', 50, '9999-12-31T23:59:59.999Z'::timestamptz)
  on conflict (user_id) do update
    set vip_expires_at = '9999-12-31T23:59:59.999Z'::timestamptz;
end;
$$;

revoke all on function public.grant_lifetime_vip(uuid) from public, anon, authenticated;
grant execute on function public.grant_lifetime_vip(uuid) to service_role;

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

  if v_order.package_id = 'vip_lifetime' then
    perform public.grant_lifetime_vip(v_order.user_id);
  else
    insert into public.user_profiles (user_id, coins_balance)
    values (v_order.user_id, v_order.coins)
    on conflict (user_id) do update
      set coins_balance = public.user_profiles.coins_balance + excluded.coins_balance;
  end if;

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

  if v_order.package_id = 'vip_lifetime' then
    perform public.grant_lifetime_vip(v_order.user_id);
  else
    insert into public.user_profiles (user_id, coins_balance)
    values (v_order.user_id, v_order.coins)
    on conflict (user_id) do update
      set coins_balance = public.user_profiles.coins_balance + excluded.coins_balance;
  end if;

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

create or replace function public.credit_apple_iap_transaction(
  p_user_id uuid,
  p_transaction_id text,
  p_original_transaction_id text,
  p_product_id text,
  p_environment text,
  p_coins integer,
  p_signed_transaction text
)
returns table(credited boolean, coins integer, balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
  new_balance integer;
  is_lifetime_vip boolean := (p_product_id = 'com.theone.er.vip.lifetime');
begin
  if p_transaction_id = '' or p_product_id = '' then
    raise exception 'invalid Apple transaction';
  end if;

  if is_lifetime_vip then
    if p_coins < 0 then
      raise exception 'invalid Apple transaction';
    end if;
  elsif p_coins <= 0 then
    raise exception 'invalid Apple transaction';
  end if;

  insert into public.apple_iap_transactions (
    user_id, transaction_id, original_transaction_id, product_id,
    environment, coins, signed_transaction
  ) values (
    p_user_id, p_transaction_id, p_original_transaction_id, p_product_id,
    p_environment, p_coins, p_signed_transaction
  ) on conflict (transaction_id) do nothing;

  get diagnostics inserted_count = row_count;

  if is_lifetime_vip then
    perform public.grant_lifetime_vip(p_user_id);
    select coalesce(coins_balance, 0) into new_balance
    from public.user_profiles where user_id = p_user_id;
  elsif inserted_count = 1 then
    insert into public.user_profiles (user_id, nickname, coins_balance)
    values (p_user_id, '', p_coins)
    on conflict (user_id) do update
      set coins_balance = coalesce(public.user_profiles.coins_balance, 0) + excluded.coins_balance
    returning coins_balance into new_balance;
  else
    select coalesce(coins_balance, 0) into new_balance
    from public.user_profiles where user_id = p_user_id;
  end if;

  return query select inserted_count = 1, p_coins, coalesce(new_balance, 0);
end;
$$;
