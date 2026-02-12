-- 批量更新历史会话标题：从AI回复中提取六爻问题
-- 
-- 这个脚本会：
-- 1. 查找标题为"请帮我解卦"或"新对话"的会话
-- 2. 从第一条AI回复中提取"**所问之事**: "后面的内容作为新标题
-- 3. 更新会话标题
--
-- ⚠️ 重要提示：
-- 由于 RLS（行级安全）策略，这个脚本需要在 Supabase Dashboard 中
-- 以管理员权限执行，或者需要临时禁用 RLS。
--
-- 使用方法：
-- 1. 登录 Supabase Dashboard
-- 2. 进入 SQL Editor
-- 3. 复制并执行此脚本
-- 4. 检查更新结果

-- 创建一个临时函数来提取六爻问题
CREATE OR REPLACE FUNCTION extract_liuyao_question(content TEXT)
RETURNS TEXT AS $$
DECLARE
  question_start INT;
  question_end INT;
  extracted_question TEXT;
BEGIN
  -- 查找 "**所问之事**: " 的位置
  question_start := position('**所问之事**: ' IN content);
  
  IF question_start = 0 THEN
    RETURN NULL;
  END IF;
  
  -- 跳过 "**所问之事**: " 这个前缀
  question_start := question_start + length('**所问之事**: ');
  
  -- 查找问题结束的位置（换行符）
  question_end := position(E'\n' IN substring(content FROM question_start));
  
  IF question_end = 0 THEN
    -- 如果没有找到换行符，取到下一个 "**" 或文件结尾
    question_end := position('**' IN substring(content FROM question_start));
    IF question_end = 0 THEN
      question_end := length(content) - question_start + 1;
    END IF;
  END IF;
  
  -- 提取问题文本
  extracted_question := trim(substring(content FROM question_start FOR question_end - 1));
  
  -- 如果提取的问题为空或太长，返回NULL
  IF extracted_question = '' OR length(extracted_question) > 50 THEN
    RETURN NULL;
  END IF;
  
  RETURN extracted_question;
END;
$$ LANGUAGE plpgsql;

-- 先查看将要更新的会话数量（预览）
SELECT 
  cs.id,
  cs.user_id,
  cs.title AS current_title,
  extract_liuyao_question(cm.content) AS new_title,
  cm.content AS ai_message_preview
FROM chat_sessions cs
INNER JOIN chat_messages cm ON cm.session_id = cs.id
WHERE cs.title IN ('请帮我解卦', '新对话')
  AND cm.role = 'assistant'
  AND cm.content LIKE '%**所问之事**: %'
  AND cm.created_at = (
    SELECT MIN(created_at)
    FROM chat_messages
    WHERE session_id = cs.id
      AND role = 'assistant'
      AND content LIKE '%**所问之事**: %'
  )
ORDER BY cs.created_at DESC;

-- 如果预览结果正确，取消下面的注释来执行更新
/*
-- 更新会话标题
UPDATE chat_sessions cs
SET title = COALESCE(
  (
    SELECT extract_liuyao_question(cm.content)
    FROM chat_messages cm
    WHERE cm.session_id = cs.id
      AND cm.role = 'assistant'
      AND cm.content LIKE '%**所问之事**: %'
    ORDER BY cm.created_at ASC
    LIMIT 1
  ),
  cs.title  -- 如果提取失败，保持原标题
)
WHERE cs.title IN ('请帮我解卦', '新对话')
  AND EXISTS (
    SELECT 1
    FROM chat_messages cm
    WHERE cm.session_id = cs.id
      AND cm.role = 'assistant'
      AND cm.content LIKE '%**所问之事**: %'
  );

-- 显示更新结果
SELECT 
  id,
  user_id,
  title,
  created_at,
  updated_at
FROM chat_sessions
WHERE title NOT IN ('请帮我解卦', '新对话')
  AND updated_at >= NOW() - INTERVAL '1 minute'
ORDER BY updated_at DESC;
*/

-- 清理临时函数（可选，执行完更新后可以删除）
-- DROP FUNCTION IF EXISTS extract_liuyao_question(TEXT);
