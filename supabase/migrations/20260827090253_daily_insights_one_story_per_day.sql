-- Preserve the three-category edition outside the exposed public schema.
create schema if not exists private;

create table if not exists private.daily_insights_legacy_20260827
(like public.daily_insights including all);

insert into private.daily_insights_legacy_20260827
select *
from public.daily_insights
where not exists (
  select 1 from private.daily_insights_legacy_20260827
);

-- The new edition starts clean and stores exactly one sourced story per date.
truncate table public.daily_insights;

alter table public.daily_insights
  drop constraint if exists daily_insights_insight_date_category_key,
  drop constraint if exists daily_insights_category_check,
  drop column if exists category,
  add column if not exists source_label text;

alter table public.daily_insights
  alter column source_label set not null,
  add constraint daily_insights_source_label_length_check
    check (char_length(source_label) between 2 and 24),
  add constraint daily_insights_insight_date_key unique (insight_date);

drop index if exists public.idx_daily_insights_date;

drop policy if exists "允许所有用户读取见闻" on public.daily_insights;
drop policy if exists "只有管理员可以插入见闻" on public.daily_insights;
drop policy if exists "只有管理员可以更新见闻" on public.daily_insights;
drop policy if exists "只有管理员可以删除见闻" on public.daily_insights;

revoke all on table public.daily_insights from anon, authenticated;
grant select on table public.daily_insights to anon, authenticated;
grant all on table public.daily_insights to service_role;

create policy "所有人可以读取见闻"
  on public.daily_insights
  for select
  to anon, authenticated
  using (true);

comment on table public.daily_insights is '今日见闻：每天一则有出处的短故事';
comment on column public.daily_insights.source_label is '前台显示的简短出处';
