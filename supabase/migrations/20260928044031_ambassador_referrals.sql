-- Server-owned attribution. Client roles cannot assign ambassadors or referrals.
create table public.ambassadors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 50),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{2,31}$'),
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.ambassador_visits (
  token uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassadors(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index ambassador_visits_expiry_idx on public.ambassador_visits(expires_at);
create table public.user_referrals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ambassador_id uuid not null references public.ambassadors(id),
  created_at timestamptz not null default now()
);
create index user_referrals_ambassador_idx on public.user_referrals(ambassador_id, user_id);
alter table public.ambassadors enable row level security;
alter table public.ambassador_visits enable row level security;
alter table public.user_referrals enable row level security;
revoke all on public.ambassadors, public.ambassador_visits, public.user_referrals from public, anon, authenticated;
grant select, insert, update on public.ambassadors to service_role;
grant select, insert, delete on public.ambassador_visits to service_role;
grant select on public.user_referrals to service_role;

create schema if not exists private;
-- Auth's insert trigger needs access to these private attribution tables. It is
-- not a callable RPC; executes only on a newly inserted auth.users row. No
-- auth.uid() is available during registration. Later metadata edits never run it.
create function private.capture_ambassador_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_referrals(user_id, ambassador_id)
  select new.id, a.id from public.ambassador_visits v
  join public.ambassadors a on a.id = v.ambassador_id
  where v.token::text = coalesce(new.raw_app_meta_data->>'ambassador_token', new.raw_user_meta_data->>'ambassador_token')
    and v.expires_at > now() and a.active and a.user_id <> new.id;
  return new;
end;
$$;
revoke all on function private.capture_ambassador_signup() from public, anon, authenticated, service_role;
create trigger capture_ambassador_signup after insert on auth.users
for each row execute function private.capture_ambassador_signup();

alter table public.wechat_login_tickets add column ambassador_token uuid;

-- Views expose only the same columns already used by the console, and are
-- service-role only. Filtering is performed in SQL before counts/pagination.
create view public.ambassador_user_profiles with (security_invoker = true) as
select t.*, r.ambassador_id from public.user_profiles t join public.user_referrals r on r.user_id = t.user_id;
create view public.ambassador_user_daily_activity with (security_invoker = true) as
select t.*, r.ambassador_id from public.user_daily_activity t join public.user_referrals r on r.user_id = t.user_id;
create view public.ambassador_jianzhongsheng_answers with (security_invoker = true) as
select t.*, r.ambassador_id from public.jianzhongsheng_answers t join public.user_referrals r on r.user_id = t.user_id;
create view public.ambassador_jianzhongsheng_comments with (security_invoker = true) as
select t.*, r.ambassador_id from public.jianzhongsheng_comments t join public.user_referrals r on r.user_id = t.user_id;
create view public.ambassador_jianzhongsheng_reports with (security_invoker = true) as
select t.*, r.ambassador_id from public.jianzhongsheng_reports t join public.user_referrals r on r.user_id = t.target_user_id;
create view public.ambassador_payment_orders with (security_invoker = true) as
select t.*, r.ambassador_id from public.payment_orders t join public.user_referrals r on r.user_id = t.user_id;
create view public.ambassador_wechat_payment_orders with (security_invoker = true) as
select t.*, r.ambassador_id from public.wechat_payment_orders t join public.user_referrals r on r.user_id = t.user_id;
create view public.ambassador_apple_iap_transactions with (security_invoker = true) as
select t.*, r.ambassador_id from public.apple_iap_transactions t join public.user_referrals r on r.user_id = t.user_id;
revoke all on public.ambassador_user_profiles from public, anon, authenticated;
grant select on public.ambassador_user_profiles to service_role;
revoke all on public.ambassador_user_daily_activity from public, anon, authenticated;
grant select on public.ambassador_user_daily_activity to service_role;
revoke all on public.ambassador_jianzhongsheng_answers from public, anon, authenticated;
grant select on public.ambassador_jianzhongsheng_answers to service_role;
revoke all on public.ambassador_jianzhongsheng_comments from public, anon, authenticated;
grant select on public.ambassador_jianzhongsheng_comments to service_role;
revoke all on public.ambassador_jianzhongsheng_reports from public, anon, authenticated;
grant select on public.ambassador_jianzhongsheng_reports to service_role;
revoke all on public.ambassador_payment_orders from public, anon, authenticated;
grant select on public.ambassador_payment_orders to service_role;
revoke all on public.ambassador_wechat_payment_orders from public, anon, authenticated;
grant select on public.ambassador_wechat_payment_orders to service_role;
revoke all on public.ambassador_apple_iap_transactions from public, anon, authenticated;
grant select on public.ambassador_apple_iap_transactions to service_role;

create function public.ambassador_performance(p_ambassador_id uuid default null, p_start timestamptz default null, p_end timestamptz default null)
returns table(id uuid, user_id uuid, name text, code text, active boolean, created_at timestamptz,
  registered_users bigint, new_users bigint, paid_users bigint, paid_orders bigint, paid_cents bigint,
  refunded_orders bigint, refunded_cents bigint, apple_orders bigint)
language sql stable security invoker set search_path = '' as $$
with orders as (
  select o.user_id, o.status, o.amount_cents, o.paid_at, o.credited_at from public.payment_orders o
  union all
  select o.user_id, o.status, o.amount_cents, o.paid_at, o.credited_at from public.wechat_payment_orders o
), payments as (
  select r.ambassador_id,
    count(distinct o.user_id) filter(where o.status = 'paid' and o.credited_at is not null) as paid_users,
    count(*) filter(where o.status = 'paid' and o.credited_at is not null) as paid_orders,
    coalesce(sum(o.amount_cents) filter(where o.status = 'paid' and o.credited_at is not null),0) as paid_cents,
    count(*) filter(where o.status = 'refunded') as refunded_orders,
    coalesce(sum(o.amount_cents) filter(where o.status = 'refunded'),0) as refunded_cents
  from orders o join public.user_referrals r on r.user_id = o.user_id
  where (p_start is null or o.paid_at >= p_start) and (p_end is null or o.paid_at < p_end)
  group by r.ambassador_id
), accounts as (
  select r.ambassador_id, count(*) as registered_users,
    count(*) filter(where (p_start is null or r.created_at >= p_start) and (p_end is null or r.created_at < p_end)) as new_users
  from public.user_referrals r group by r.ambassador_id
), apple as (
  select r.ambassador_id, count(*) as apple_orders from public.apple_iap_transactions o
  join public.user_referrals r on r.user_id = o.user_id
  where o.environment = 'Production' and (p_start is null or o.created_at >= p_start) and (p_end is null or o.created_at < p_end)
  group by r.ambassador_id
)
select a.id,a.user_id,a.name,a.code,a.active,a.created_at,
 coalesce(u.registered_users,0),coalesce(u.new_users,0),coalesce(p.paid_users,0),coalesce(p.paid_orders,0),coalesce(p.paid_cents,0),
 coalesce(p.refunded_orders,0),coalesce(p.refunded_cents,0),coalesce(i.apple_orders,0)
from public.ambassadors a left join accounts u on u.ambassador_id=a.id
left join payments p on p.ambassador_id=a.id left join apple i on i.ambassador_id=a.id
where p_ambassador_id is null or a.id=p_ambassador_id
order by a.created_at desc, a.id;
$$;
revoke all on function public.ambassador_performance(uuid,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.ambassador_performance(uuid,timestamptz,timestamptz) to service_role;
