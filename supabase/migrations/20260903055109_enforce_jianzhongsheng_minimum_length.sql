-- Existing short notes remain readable. The answer constraint is added as NOT
-- VALID so it applies to future writes without rejecting older 8–14 character
-- rows. Comments only need to contain non-whitespace text and have no length cap.

alter table public.jianzhongsheng_answers
  drop constraint if exists jianzhongsheng_answers_body_check;

alter table public.jianzhongsheng_answers
  add constraint jianzhongsheng_answers_body_check
  check (char_length(trim(body)) between 15 and 3000) not valid;

alter table public.jianzhongsheng_comments
  drop constraint if exists jianzhongsheng_comments_body_check;

alter table public.jianzhongsheng_comments
  add constraint jianzhongsheng_comments_body_check
  check (char_length(trim(body)) >= 1) not valid;
