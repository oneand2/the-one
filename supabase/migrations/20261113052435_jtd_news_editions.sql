-- One atomic editorial snapshot per issue. The archive index can select just
-- issue_date and cover without transferring every story or loading past issues.
create table public.jtd_news_editions (
  issue_date date primary key,
  lunar text not null,
  description text not null default '',
  cover jsonb not null check (jsonb_typeof(cover) = 'object'),
  stories jsonb not null check (
    jsonb_typeof(stories) = 'array' and stories <> '[]'::jsonb
  ),
  published_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

comment on column public.jtd_news_editions.published_at is
  'NULL denotes a draft. Server readers must filter published_at <= now(); publication never grants direct database access.';

-- Explicit grants matter on projects configured to grant CRUD to all API roles
-- by default. A newspaper reader never needs a database or storage credential.
alter table public.jtd_news_editions enable row level security;
revoke all on table public.jtd_news_editions from public, anon, authenticated, service_role;
grant select, insert, update on table public.jtd_news_editions to service_role;

-- Writers filter by their last-seen revision when correcting an existing issue.
create function public.jtd_news_bump_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.jtd_news_bump_revision() from public, anon, authenticated;
create trigger jtd_news_editions_before_update before update on public.jtd_news_editions
  for each row execute function public.jtd_news_bump_revision();

-- Never make this bucket public, even for published editions. The application
-- checks the edition before serving its image. No signed URLs belong in rows.
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('jtd-news-photos', 'jtd-news-photos', false,
        array['image/jpeg','image/png','image/webp','image/avif'], 16777216),
       -- Original offline editions only; never serve this bucket as a photo.
       ('jtd-news-legacy', 'jtd-news-legacy', false, array['text/html'], 16777216);

-- Deny direct access to this bucket even if an existing permissive policy on
-- storage.objects allows a logged-in user to read or write other buckets.
-- Other bucket IDs retain their existing policies. service_role bypasses RLS.
create policy jtd_news_objects_server_only on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id not in ('jtd-news-photos','jtd-news-legacy'))
  with check (bucket_id not in ('jtd-news-photos','jtd-news-legacy'));
