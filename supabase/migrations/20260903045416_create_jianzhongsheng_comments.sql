create table public.jianzhongsheng_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null check (char_length(entry_id) between 1 and 120),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_id text not null check (char_length(display_id) between 1 and 32),
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jianzhongsheng_comments_entry_created_idx
  on public.jianzhongsheng_comments (entry_id, created_at asc);

create index jianzhongsheng_comments_user_idx
  on public.jianzhongsheng_comments (user_id);

alter table public.jianzhongsheng_comments enable row level security;

revoke all on table public.jianzhongsheng_comments from anon, authenticated;
grant select on table public.jianzhongsheng_comments to anon, authenticated;
grant insert on table public.jianzhongsheng_comments to authenticated;

create policy "jianzhongsheng comments are publicly readable"
  on public.jianzhongsheng_comments
  for select
  to anon, authenticated
  using (true);

create policy "users can add their own jianzhongsheng comments"
  on public.jianzhongsheng_comments
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
