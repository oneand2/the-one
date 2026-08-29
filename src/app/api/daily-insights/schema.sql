-- 今日见闻（见天地）：每天一则有出处的短故事
CREATE TABLE IF NOT EXISTS public.daily_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_date DATE NOT NULL UNIQUE,
  -- 仅供尚未更新的旧前端完成查询；始终为空，新版不读取，发布稳定后可删除
  category TEXT NOT NULL DEFAULT '',
  -- 标题：名词性短语，二到五字
  title TEXT NOT NULL,
  -- 前台显示的简短出处，如《庄子·天道》
  source_label TEXT NOT NULL CHECK (char_length(source_label) BETWEEN 2 AND 24),
  -- 原文语种与原文；中文经典存文言，外国经典存原语言文本
  original_language TEXT NOT NULL CHECK (char_length(original_language) BETWEEN 2 AND 12),
  original_text TEXT NOT NULL CHECK (char_length(original_text) BETWEEN 20 AND 1600),
  -- 译文：段落之间用空行分隔
  body TEXT NOT NULL,
  -- 完整来源留档，仅供内部核查，前台不展示
  sources TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.daily_insights ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.daily_insights FROM anon, authenticated;
GRANT SELECT ON TABLE public.daily_insights TO anon, authenticated;
GRANT ALL ON TABLE public.daily_insights TO service_role;

CREATE POLICY "所有人可以读取见闻"
  ON public.daily_insights
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 写入统一由服务端发布脚本使用 service_role 完成。
