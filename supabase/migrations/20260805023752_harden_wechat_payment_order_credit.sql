-- 对已部署的微信支付入账函数补充输入和订单状态校验。

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
