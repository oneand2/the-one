create table if not exists public.jianzhongsheng_answers (
  id uuid primary key default gen_random_uuid(),
  question_id text not null check (char_length(question_id) between 1 and 80),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_id text not null check (char_length(display_id) between 1 and 32),
  body text not null check (char_length(trim(body)) between 8 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create index if not exists jianzhongsheng_answers_question_created_idx
  on public.jianzhongsheng_answers (question_id, created_at asc);

create index if not exists jianzhongsheng_answers_user_idx
  on public.jianzhongsheng_answers (user_id);

alter table public.jianzhongsheng_answers enable row level security;

revoke all on table public.jianzhongsheng_answers from anon, authenticated;
grant select on table public.jianzhongsheng_answers to anon, authenticated;
grant insert, update on table public.jianzhongsheng_answers to authenticated;

create policy "jianzhongsheng answers are publicly readable"
  on public.jianzhongsheng_answers
  for select
  to anon, authenticated
  using (true);

create policy "users can add their own jianzhongsheng answer"
  on public.jianzhongsheng_answers
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can revise their own jianzhongsheng answer"
  on public.jianzhongsheng_answers
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
