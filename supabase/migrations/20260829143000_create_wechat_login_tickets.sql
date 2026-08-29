create table if not exists public.wechat_login_tickets (
  id text primary key,
  mode text not null check (mode in ('login', 'bind')),
  next_path text not null default '/',
  bind_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'authorized', 'consumed')),
  user_id uuid references auth.users(id) on delete cascade,
  url_link text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wechat_login_tickets_expires_at_idx
  on public.wechat_login_tickets (expires_at);

alter table public.wechat_login_tickets enable row level security;

revoke all on table public.wechat_login_tickets from anon, authenticated;
