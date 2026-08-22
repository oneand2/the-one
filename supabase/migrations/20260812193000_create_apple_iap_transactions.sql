create table if not exists public.apple_iap_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  transaction_id text not null unique,
  original_transaction_id text not null,
  product_id text not null,
  environment text not null,
  coins integer not null check (coins > 0),
  signed_transaction text not null,
  created_at timestamptz not null default now()
);

alter table public.apple_iap_transactions enable row level security;

create policy "users can view their Apple purchases"
  on public.apple_iap_transactions
  for select
  using (auth.uid() = user_id);

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
begin
  if p_coins <= 0 or p_transaction_id = '' or p_product_id = '' then
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

  if inserted_count = 1 then
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

revoke all on function public.credit_apple_iap_transaction(uuid, text, text, text, text, integer, text) from public;
grant execute on function public.credit_apple_iap_transaction(uuid, text, text, text, text, integer, text) to service_role;
