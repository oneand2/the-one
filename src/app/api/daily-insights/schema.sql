-- 今日见闻（见天地）：每天 地 / 时 / 物 各一条
CREATE TABLE IF NOT EXISTS daily_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_date DATE NOT NULL,
  -- 类目：地=别的地方，时=从前，物=人以外的东西
  category TEXT NOT NULL CHECK (category IN ('地', '时', '物')),
  -- 标题：名词性短语，二到五字
  title TEXT NOT NULL,
  -- 正文：段落之间用空行分隔
  body TEXT NOT NULL,
  -- 来源留档，仅供内部核查，前台不展示
  sources TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- 同一天同一类目只能有一条
  UNIQUE (insight_date, category)
);

CREATE INDEX IF NOT EXISTS idx_daily_insights_date ON daily_insights(insight_date DESC);

ALTER TABLE daily_insights ENABLE ROW LEVEL SECURITY;

-- 所有人可读
CREATE POLICY "允许所有用户读取见闻"
  ON daily_insights
  FOR SELECT
  USING (true);

-- 仅管理员可写（与 world_news 一致）
CREATE POLICY "只有管理员可以插入见闻"
  ON daily_insights
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = '892777353@qq.com'
    )
  );

CREATE POLICY "只有管理员可以更新见闻"
  ON daily_insights
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = '892777353@qq.com'
    )
  );

CREATE POLICY "只有管理员可以删除见闻"
  ON daily_insights
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = '892777353@qq.com'
    )
  );
