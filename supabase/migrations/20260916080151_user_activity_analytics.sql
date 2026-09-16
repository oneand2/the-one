-- Authenticated activity only. One account per Beijing calendar day.
create table public.user_daily_activity (
  activity_date date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  primary key (activity_date, user_id),
  constraint activity_time_order check (last_seen_at >= first_seen_at)
);
create index user_daily_activity_user_id_idx on public.user_daily_activity (user_id);

create table public.user_activity_coverage (
  id smallint primary key default 1 check (id = 1),
  started_at timestamptz not null
);

alter table public.user_daily_activity enable row level security;
alter table public.user_activity_coverage enable row level security;
revoke all on public.user_daily_activity, public.user_activity_coverage from public, anon, authenticated;
grant select, insert, update, delete on public.user_daily_activity, public.user_activity_coverage to service_role;

create function public.record_user_activity(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recorded_at timestamptz := clock_timestamp();
  recorded_day date := (recorded_at at time zone 'Asia/Shanghai')::date;
begin
  insert into public.user_daily_activity (activity_date, user_id, first_seen_at, last_seen_at)
  values (recorded_day, p_user_id, recorded_at, recorded_at)
  on conflict (activity_date, user_id) do update
    set last_seen_at = greatest(public.user_daily_activity.last_seen_at, excluded.last_seen_at);

  insert into public.user_activity_coverage (id, started_at) values (1, recorded_at)
  on conflict (id) do nothing;
end;
$$;
revoke all on function public.record_user_activity(uuid) from public, anon, authenticated;
grant execute on function public.record_user_activity(uuid) to service_role;

comment on table public.user_daily_activity is 'Authenticated website interactions and instrumented native API activity; no anonymous visits or historical backfill.';
comment on table public.user_activity_coverage is 'Timestamp of first collected activity. Earlier dates are unknown, never zero-filled.';
