create table if not exists public.wechat_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  app_id text not null,
  openid text not null,
  unionid text,
  nickname text not null default '',
  avatar_url text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wechat_identities_app_openid_key unique (app_id, openid)
);

create unique index if not exists wechat_identities_unionid_key
  on public.wechat_identities (unionid)
  where unionid is not null;

alter table public.wechat_identities enable row level security;

-- 微信身份只允许可信服务端通过 service role 访问，不向浏览器 Data API 开放。
revoke all on table public.wechat_identities from anon, authenticated;
