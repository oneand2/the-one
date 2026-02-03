-- 设备指纹表：用于限制「IP 注册」新人 50 铜币仅每设备一次
-- 在 Supabase SQL Editor 中执行

create table if not exists device_fingerprints (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_device_fingerprints_visitor_id on device_fingerprints(visitor_id);

comment on table device_fingerprints is 'IP 注册设备指纹，用于防刷新人 50 铜币';
comment on column device_fingerprints.visitor_id is 'FingerprintJS visitorId';
comment on column device_fingerprints.user_id is '首次在该设备上领取奖励的用户 id（可选）';

-- 仅服务端（API/Server Action）需要写此表，建议不开放 anon 写权限，由 service role 或 RLS 限制
alter table device_fingerprints enable row level security;

-- 禁止 anon/authenticated 直接读写，由后端使用 service_role 操作
create policy "禁止客户端直接访问"
  on device_fingerprints for all
  using (false)
  with check (false);
