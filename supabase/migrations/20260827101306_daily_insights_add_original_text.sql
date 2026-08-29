alter table public.daily_insights
  add column if not exists original_language text,
  add column if not exists original_text text;

comment on column public.daily_insights.original_language is
  '原文语种：文言、古希腊语、波斯语、英语等';
comment on column public.daily_insights.original_text is
  '经典原文；中文经典存文言，外国经典存原语言文本';
