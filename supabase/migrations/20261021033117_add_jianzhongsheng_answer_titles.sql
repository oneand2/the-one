-- Keep existing user notes untitled. Titles are optional and counted as
-- PostgreSQL characters (Unicode code points), matching the API limit.
alter table public.jianzhongsheng_answers
  add column if not exists title text not null default '';

alter table public.jianzhongsheng_answers
  add constraint jianzhongsheng_answers_title_check
  check (char_length(title) <= 24);

comment on column public.jianzhongsheng_answers.title is
  'Optional note title, at most 24 Unicode code points; empty for untitled notes.';

notify pgrst, 'reload schema';
