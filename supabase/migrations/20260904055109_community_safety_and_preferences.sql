alter table public.user_profiles
  add column if not exists juexingcang_meditation_default boolean not null default true,
  add column if not exists community_suspended_until timestamptz;

alter table public.jianzhongsheng_answers
  add column if not exists moderation_status text not null default 'visible',
  add column if not exists moderation_reason text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null;

alter table public.jianzhongsheng_answers
  drop constraint if exists jianzhongsheng_answers_moderation_status_check;
alter table public.jianzhongsheng_answers
  add constraint jianzhongsheng_answers_moderation_status_check
  check (moderation_status in ('visible', 'hidden', 'removed'));

alter table public.jianzhongsheng_answers
  drop constraint if exists jianzhongsheng_answers_body_check;
alter table public.jianzhongsheng_answers
  add constraint jianzhongsheng_answers_body_check
  check (char_length(trim(body)) between 15 and 3000) not valid;

alter table public.jianzhongsheng_comments
  add column if not exists moderation_status text not null default 'visible',
  add column if not exists moderation_reason text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null;

alter table public.jianzhongsheng_comments
  drop constraint if exists jianzhongsheng_comments_moderation_status_check;
alter table public.jianzhongsheng_comments
  add constraint jianzhongsheng_comments_moderation_status_check
  check (moderation_status in ('visible', 'hidden', 'removed'));

alter table public.jianzhongsheng_comments
  drop constraint if exists jianzhongsheng_comments_body_check;
alter table public.jianzhongsheng_comments
  add constraint jianzhongsheng_comments_body_check
  check (char_length(trim(body)) between 1 and 800) not valid;

create table if not exists public.jianzhongsheng_user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_display_id text not null check (char_length(blocked_display_id) between 1 and 32),
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);

create index if not exists jianzhongsheng_user_blocks_blocker_idx
  on public.jianzhongsheng_user_blocks (blocker_id, created_at desc);

alter table public.jianzhongsheng_user_blocks enable row level security;

create table if not exists public.jianzhongsheng_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  content_type text not null check (content_type in ('answer', 'comment')),
  content_id uuid not null,
  reason text not null check (reason in ('sexual', 'hate', 'harassment', 'dangerous', 'spam', 'other')),
  details text check (details is null or char_length(details) <= 500),
  snapshot_display_id text not null,
  snapshot_body text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  unique (reporter_id, content_type, content_id)
);

create index if not exists jianzhongsheng_reports_status_created_idx
  on public.jianzhongsheng_reports (status, created_at desc);
create index if not exists jianzhongsheng_reports_target_idx
  on public.jianzhongsheng_reports (target_user_id, created_at desc);

alter table public.jianzhongsheng_reports enable row level security;

-- Community writes go through authenticated server routes so filtering and
-- rate limits cannot be bypassed by calling PostgREST directly.
revoke all on table public.jianzhongsheng_answers from anon, authenticated;
revoke all on table public.jianzhongsheng_comments from anon, authenticated;
grant select on table public.jianzhongsheng_answers to anon, authenticated;
grant select on table public.jianzhongsheng_comments to anon, authenticated;

drop policy if exists "jianzhongsheng answers are publicly readable"
  on public.jianzhongsheng_answers;
drop policy if exists "users can add their own jianzhongsheng answer"
  on public.jianzhongsheng_answers;
drop policy if exists "users can revise their own jianzhongsheng answer"
  on public.jianzhongsheng_answers;

create policy "visible jianzhongsheng answers are publicly readable"
  on public.jianzhongsheng_answers
  for select
  to anon, authenticated
  using (moderation_status = 'visible');

drop policy if exists "jianzhongsheng comments are publicly readable"
  on public.jianzhongsheng_comments;
drop policy if exists "users can add their own jianzhongsheng comments"
  on public.jianzhongsheng_comments;

create policy "visible jianzhongsheng comments are publicly readable"
  on public.jianzhongsheng_comments
  for select
  to anon, authenticated
  using (moderation_status = 'visible');

revoke all on table public.jianzhongsheng_user_blocks from anon, authenticated;
revoke all on table public.jianzhongsheng_reports from anon, authenticated;

-- A signed-in user may only initialize and edit non-financial profile fields.
-- Balances and VIP status remain writable solely through service-role code.
revoke all on table public.user_profiles from anon, authenticated;
grant select on table public.user_profiles to authenticated;
grant insert (user_id, nickname, juexingcang_meditation_default)
  on public.user_profiles to authenticated;
grant update (user_id, nickname, invite_code, juexingcang_meditation_default)
  on public.user_profiles to authenticated;

-- Deduct balances atomically so concurrent requests cannot overspend or write a
-- negative balance. This function is service-role only.
create or replace function public.consume_user_coins(
  p_user_id uuid,
  p_amount integer
)
returns table (success boolean, balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 then
    raise exception 'invalid coin deduction';
  end if;

  insert into public.user_profiles (user_id, nickname)
  values (p_user_id, '')
  on conflict (user_id) do nothing;

  update public.user_profiles
  set coins_balance = coins_balance - p_amount
  where user_id = p_user_id
    and coins_balance >= p_amount
  returning coins_balance into v_balance;

  if found then
    return query select true, v_balance;
  end if;

  select coins_balance into v_balance
  from public.user_profiles
  where user_id = p_user_id;
  return query select false, coalesce(v_balance, 0);
end;
$$;

revoke execute on function public.consume_user_coins(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_user_coins(uuid, integer) to service_role;
