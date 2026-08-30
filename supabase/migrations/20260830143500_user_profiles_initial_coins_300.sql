-- 新注册用户档案默认赠送 300 铜币（原为 50）
alter table public.user_profiles
  alter column coins_balance set default 300;
