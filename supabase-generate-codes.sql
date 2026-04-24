-- ============================================================
--  批量生成铜币兑换码
--  在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================
--  ✏️  修改下面两个变量即可：
--    coin_value  : 每张码的铜币面值（默认 100）
--    code_count  : 本次生成数量（默认 20）
-- ============================================================

do $$
declare
  coin_value  int := 100;   -- 👈 铜币面值，改成你想要的数字
  code_count  int := 20;    -- 👈 生成数量，改成你想要的数字
  prefix      text;
begin
  -- 前缀根据面值自动生成，如 COIN100-、COIN1000-
  prefix := 'COIN' || coin_value::text || '-';

  insert into redemption_codes (code, coins)
  select
    prefix || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    coin_value
  from generate_series(1, code_count);

  raise notice '✅ 已生成 % 张 % 铜币兑换码', code_count, coin_value;
end $$;

-- 查看刚生成的、尚未使用的兑换码（按创建时间倒序）
select code, coins, created_at
from redemption_codes
where is_used = false
order by created_at desc
limit 50;
