alter table public.daily_insights
  alter column original_language set not null,
  alter column original_text set not null,
  add constraint daily_insights_original_language_length_check
    check (char_length(original_language) between 2 and 12),
  add constraint daily_insights_original_text_length_check
    check (char_length(original_text) between 20 and 1600);
