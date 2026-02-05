-- 批量生成「1000 铜币」兑换码
-- 在 Supabase Dashboard → SQL Editor 中执行
-- 前提：已执行过 src/app/api/shop/schema.sql（存在 redemption_codes 表和 redeem_code 函数）

-- 生成数量：修改下面 generate_series(1, 10) 里的 10 为你想要的数量（如 50、100）
insert into redemption_codes (code, coins)
select
  'COIN1000-' || upper(replace(gen_random_uuid()::text, '-', '')),
  1000
from generate_series(1, 10)
returning code, coins, created_at;
-- 执行后结果区会显示本批生成的兑换码，可复制保存或发给用户使用
