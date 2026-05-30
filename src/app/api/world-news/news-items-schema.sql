-- ─────────────────────────────────────────────────────────────────────────────
-- news_items：结构化「新闻标题库」（占问前程功能的第 1 级数据漏斗）
--
-- 每条新闻一行，存：日期、板块、标题、正文摘要、消息来源、原文链接。
-- 由 world_news（一天一行的大文本）解析回填而来，并在管理端发布时自动同步。
-- 占问前程时，按用户问题在此表做关键词匹配（第 2 级），只把命中的摘要注入提示词。
-- ─────────────────────────────────────────────────────────────────────────────

-- 模糊匹配加速（Supabase 默认可用）。无权限时可注释掉，ILIKE 仍可工作。
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS news_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  news_date DATE NOT NULL,
  section TEXT,            -- 板块，如「国际与地缘」「金融与科技」「民生与社会」
  title TEXT NOT NULL,     -- 新闻标题（二级标题）
  summary TEXT,            -- 正文摘要（标题下的正文段落 + 利好/利空）
  source TEXT,             -- 消息来源
  url TEXT,                -- 原文链接（来自「新闻链接查证」，可空）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 按日期查询/过滤近一年
CREATE INDEX IF NOT EXISTS idx_news_items_date ON news_items(news_date DESC);

-- 标题/摘要的关键词模糊匹配加速
CREATE INDEX IF NOT EXISTS idx_news_items_title_trgm ON news_items USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_news_items_summary_trgm ON news_items USING gin (summary gin_trgm_ops);

-- 启用 RLS（与 world_news 一致：公开读，仅管理员写）
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;

-- 策略 1：所有用户都可以读取（占问前程检索需要）
DROP POLICY IF EXISTS "允许所有用户读取标题库" ON news_items;
CREATE POLICY "允许所有用户读取标题库"
  ON news_items
  FOR SELECT
  USING (true);

-- 注意：策略中不要直接 SELECT auth.users（authenticated 角色无权读该表，会报
-- "permission denied for table users"）。改用安全函数 auth.jwt() 取当前用户邮箱。

-- 策略 2：只有管理员可以插入
DROP POLICY IF EXISTS "只有管理员可以插入标题库" ON news_items;
CREATE POLICY "只有管理员可以插入标题库"
  ON news_items
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = '892777353@qq.com');

-- 策略 3：只有管理员可以更新
DROP POLICY IF EXISTS "只有管理员可以更新标题库" ON news_items;
CREATE POLICY "只有管理员可以更新标题库"
  ON news_items
  FOR UPDATE
  USING (auth.jwt() ->> 'email' = '892777353@qq.com');

-- 策略 4：只有管理员可以删除
DROP POLICY IF EXISTS "只有管理员可以删除标题库" ON news_items;
CREATE POLICY "只有管理员可以删除标题库"
  ON news_items
  FOR DELETE
  USING (auth.jwt() ->> 'email' = '892777353@qq.com');
