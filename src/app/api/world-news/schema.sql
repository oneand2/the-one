-- 创建 world_news 表
CREATE TABLE IF NOT EXISTS world_news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  news_date DATE NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引，优化按日期查询
CREATE INDEX IF NOT EXISTS idx_world_news_date ON world_news(news_date DESC);

-- 启用 RLS（行级安全）
ALTER TABLE world_news ENABLE ROW LEVEL SECURITY;

-- 策略 1：所有用户都可以读取新闻（SELECT）
CREATE POLICY "允许所有用户读取新闻"
  ON world_news
  FOR SELECT
  USING (true);

-- 策略 2：只有管理员（邮箱为 892777353@qq.com）可以插入新闻
CREATE POLICY "只有管理员可以插入新闻"
  ON world_news
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = '892777353@qq.com'
    )
  );

-- 策略 3：只有管理员可以更新新闻
CREATE POLICY "只有管理员可以更新新闻"
  ON world_news
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = '892777353@qq.com'
    )
  );

-- 策略 4：只有管理员可以删除新闻
CREATE POLICY "只有管理员可以删除新闻"
  ON world_news
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = '892777353@qq.com'
    )
  );
