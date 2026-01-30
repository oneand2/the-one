# 对话历史记录保存问题排查

## 已添加的改进

### 1. 增强错误处理和日志

我已经在关键函数中添加了详细的日志记录，以便追踪问题：

#### `createNewSession`
- 成功时：输出 "新会话创建成功: {session对象}"
- 失败时：输出 "创建会话失败: {状态码} {错误信息}"

#### `loadSessions`
- 成功时：输出 "会话列表已加载，共 X 个会话"
- 失败时：输出 "加载会话列表失败: {状态码} {错误信息}"

#### `saveMessagesToSession`
- 成功时：输出 "消息保存成功: {结果}"
- 失败时：输出 "保存消息失败: {状态码} {错误信息}"

#### `handleSend`
- 创建会话时：输出 "当前没有会话，正在创建新会话..."
- 会话创建成功：输出 "新会话已创建，ID: {sessionId}"
- 会话创建失败：输出 "创建新会话失败，对话将不会被保存"
- 使用现有会话：输出 "使用现有会话，ID: {sessionId}"
- 保存成功：输出 "对话已保存到历史记录，会话ID: {sessionId}"
- 保存失败：输出 "保存对话失败，但对话将继续: {错误}"

## 排查步骤

### 1. 打开浏览器开发者工具

1. 在浏览器中打开应用
2. 按 `F12` 或 `Cmd+Option+I` (Mac) 打开开发者工具
3. 切换到 **Console (控制台)** 标签页

### 2. 发送一条测试消息

发送任意消息，观察控制台输出，应该看到以下日志序列：

**如果是第一次对话：**
```
当前没有会话，正在创建新会话...
新会话创建成功: {id: "...", title: "新对话", ...}
新会话已创建，ID: xxx-xxx-xxx
[对话流式返回]
消息保存成功: [...]
对话已保存到历史记录，会话ID: xxx-xxx-xxx
会话列表已加载，共 1 个会话
```

**如果是继续对话：**
```
使用现有会话，ID: xxx-xxx-xxx
[对话流式返回]
消息保存成功: [...]
对话已保存到历史记录，会话ID: xxx-xxx-xxx
会话列表已加载，共 X 个会话
```

### 3. 检查是否有错误

如果看到以下错误，说明有问题：

#### 错误1：创建会话失败
```
创建会话失败: 401 {error: "请先登录"}
```
**原因**：用户未登录
**解决**：确保用户已登录

#### 错误2：保存消息失败 - 401
```
保存消息失败: 401 {error: "请先登录"}
```
**原因**：用户会话过期
**解决**：重新登录

#### 错误3：保存消息失败 - 404
```
保存消息失败: 404 {error: "会话不存在或无权访问"}
```
**原因**：会话ID无效或不属于当前用户
**解决**：刷新页面，重新创建会话

#### 错误4：保存消息失败 - 500
```
保存消息失败: 500 {error: "保存消息失败"}
```
**原因**：数据库错误（表不存在、权限问题等）
**解决**：检查数据库表是否已创建

### 4. 检查数据库表

如果持续出现 500 错误，需要检查数据库：

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 运行以下查询检查表是否存在：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('chat_sessions', 'chat_messages');

-- 检查会话表
SELECT * FROM chat_sessions LIMIT 5;

-- 检查消息表
SELECT * FROM chat_messages LIMIT 5;
```

如果表不存在，运行项目中的 SQL 脚本：
```
src/app/api/chat-sessions/schema.sql
```

### 5. 检查 RLS (Row Level Security) 策略

确保 RLS 策略已正确设置：

```sql
-- 检查策略
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('chat_sessions', 'chat_messages');
```

应该看到以下策略：
- 用户只能查看自己的会话
- 用户可以创建自己的会话
- 用户可以更新自己的会话
- 用户可以删除自己的会话
- 用户只能查看自己会话的消息
- 用户可以创建自己会话的消息
- 用户可以删除自己会话的消息

### 6. 检查网络请求

在开发者工具中切换到 **Network (网络)** 标签页：

1. 发送一条消息
2. 找到以下请求：
   - `POST /api/chat-sessions` (如果是新会话)
   - `POST /api/chat-sessions/{id}/messages` (保存消息)
   - `PATCH /api/chat-sessions/{id}` (更新标题)
   - `GET /api/chat-sessions` (刷新列表)

3. 检查每个请求的状态码和响应

## 常见问题和解决方案

### 问题1：消息发送成功，但历史记录为空

**可能原因：**
1. `currentSessionId` 为 null
2. 会话创建失败
3. 保存消息的 API 调用失败

**排查方法：**
1. 查看控制台日志，确认是否有 "新会话已创建" 或 "使用现有会话"
2. 确认是否有 "对话已保存到历史记录" 日志
3. 检查网络请求中的 `/api/chat-sessions/{id}/messages` 请求

### 问题2：会话列表不更新

**可能原因：**
1. `loadSessions` 调用失败
2. 数据库查询返回空结果
3. RLS 策略阻止了查询

**排查方法：**
1. 查看控制台是否有 "会话列表已加载，共 X 个会话"
2. 如果显示 "共 0 个会话"，检查数据库中是否真的有数据
3. 检查 RLS 策略是否正确

### 问题3：第一条消息保存失败

**可能原因：**
1. 会话创建成功但 `sessionId` 没有正确传递
2. API 调用时机问题

**排查方法：**
1. 在控制台查找 "新会话已创建，ID: xxx"
2. 确认后续是否有 "对话已保存到历史记录，会话ID: xxx"
3. 两个 ID 应该一致

### 问题4：移动端正常，桌面端不正常（或反之）

**可能原因：**
1. 状态管理问题
2. 响应式设计导致的按钮点击问题

**排查方法：**
1. 两端都打开控制台查看日志
2. 比较日志差异

## 代码改进说明

### 改进1：错误处理增强

**之前：**
```tsx
await saveMessagesToSession(sessionId, [userMessage, assistantMessage]);
```

**现在：**
```tsx
try {
  await saveMessagesToSession(sessionId, [userMessage, assistantMessage]);
  console.log('对话已保存到历史记录，会话ID:', sessionId);
} catch (saveError) {
  console.error('保存对话失败，但对话将继续:', saveError);
}
```

**好处：**
- 保存失败不会中断用户对话
- 记录详细错误信息便于排查

### 改进2：日志记录

在所有关键操作中添加了 `console.log` 和 `console.error`，便于：
- 追踪执行流程
- 定位问题所在
- 了解状态变化

### 改进3：响应检查

**之前：**
```tsx
await fetch(...);
```

**现在：**
```tsx
const response = await fetch(...);
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.error('错误:', response.status, errorData);
  throw new Error(`失败: ${response.status}`);
}
```

**好处：**
- 能看到具体的错误状态码
- 能看到服务器返回的错误信息
- 便于诊断 API 问题

## 下一步

1. **测试**：发送几条消息，观察控制台日志
2. **记录**：将控制台的完整输出复制给我
3. **检查**：如果有错误，按照上述排查步骤进行
4. **反馈**：告诉我具体看到了什么日志和错误

这样我就能准确定位问题并提供解决方案。
