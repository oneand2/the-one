-- daoyoushuju：统一存储「古典排盘」与「八维结果」，通过 type 区分，详情在 input_data(JSONB)
-- 若项目中已有该表且结构一致，无需再执行；仅作参考。

-- 表结构示意（按你现有 daoyoushuju 的 design 调整列名/类型即可）：
-- id         uuid primary key default gen_random_uuid()
-- user_id    uuid not null references auth.users(id) on delete cascade
-- type       text not null   -- 'classical_bazi' | 'mbti'
-- input_data jsonb not null default '{}'
-- created_at timestamptz not null default now()

-- 古典排盘：type = 'classical_bazi'，input_data = { "params": { "mode","year","month",... } }
-- 八维结果：type = 'mbti'，         input_data = { "type": "INFP", "function_scores": { "Se": 12, ... } }
