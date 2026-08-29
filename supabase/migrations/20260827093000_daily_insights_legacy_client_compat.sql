-- Keep the currently deployed client readable until the date-only story UI is released.
-- The value stays empty, so no legacy 时 / 地 / 物 category is exposed.
alter table public.daily_insights
  add column if not exists category text not null default '';

comment on column public.daily_insights.category is
  'Deprecated read compatibility for clients deployed before 2026-08-27; always empty';
