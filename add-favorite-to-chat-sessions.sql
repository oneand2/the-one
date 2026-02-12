-- 添加收藏字段到聊天会话表
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- 创建索引以便快速查询收藏的会话
CREATE INDEX IF NOT EXISTS idx_chat_sessions_favorite ON chat_sessions(user_id, is_favorite, updated_at DESC);

-- 添加注释
COMMENT ON COLUMN chat_sessions.is_favorite IS '是否收藏此对话';
