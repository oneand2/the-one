-- 今日见闻的唯一内容源是 content/YYYY-MM-DD-week.json。
-- 原文较长且含多语种字符，不在 SQL 中维护第二份副本，以免题名、原文和译文漂移。
-- 初始化 schema.sql 后，请在项目根目录运行：
-- npm run insights:publish -- --file content/2026-08-27-week.json

DO $$
BEGIN
  RAISE NOTICE '请使用 insights:publish 从周稿写入今日见闻内容';
END
$$;
