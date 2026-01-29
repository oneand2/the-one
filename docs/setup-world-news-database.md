# 设置 见天地 新闻数据库

如果您在发布新闻时遇到"发布失败"的错误，请按照以下步骤设置数据库：

## 步骤 1: 登录 Supabase Dashboard

1. 访问 [https://supabase.com](https://supabase.com)
2. 登录您的账号
3. 选择您的项目

## 步骤 2: 执行 SQL 脚本

1. 在左侧菜单中点击 **SQL Editor**
2. 点击 **New Query** 创建新查询
3. 复制并粘贴 `/src/app/api/world-news/schema.sql` 文件的全部内容
4. 点击 **Run** 执行 SQL

SQL 文件路径：`src/app/api/world-news/schema.sql`

## 步骤 3: 验证表已创建

1. 在左侧菜单中点击 **Table Editor**
2. 您应该能看到 `world_news` 表
3. 表结构应该包含以下字段：
   - `id` (UUID, 主键)
   - `news_date` (DATE, 唯一)
   - `content` (TEXT)
   - `created_at` (TIMESTAMP)

## 步骤 4: 验证 RLS 策略

1. 在 Table Editor 中，点击 `world_news` 表
2. 点击右上角的齿轮图标，选择 **Policies**
3. 您应该能看到 4 条策略：
   - ✅ 允许所有用户读取新闻 (SELECT)
   - ✅ 只有管理员可以插入新闻 (INSERT)
   - ✅ 只有管理员可以更新新闻 (UPDATE)
   - ✅ 只有管理员可以删除新闻 (DELETE)

## 步骤 5: 测试连接

1. 返回新闻发布页面 `/admin/news`
2. 点击 **🔧 测试数据库连接** 按钮
3. 如果显示 "✅ 数据库连接正常！所有权限检查通过！"，则设置成功

## 常见错误

### 错误 1: "relation 'world_news' does not exist"
**原因**: 表未创建  
**解决**: 重新执行步骤 2 的 SQL 脚本

### 错误 2: "new row violates row-level security policy"
**原因**: RLS 策略未配置或管理员邮箱不匹配  
**解决**: 
1. 确认您使用的邮箱是 `892777353@qq.com`
2. 重新执行步骤 2 的 SQL 脚本
3. 退出并重新登录

### 错误 3: "permission denied for table"
**原因**: 数据库权限问题  
**解决**: 
1. 检查您的 Supabase 项目设置
2. 确认 RLS 已启用
3. 重新执行步骤 2 的 SQL 脚本

## 示例数据

如果您想插入示例新闻测试，可以执行：

```sql
-- 插入示例新闻
INSERT INTO world_news (news_date, content)
VALUES ('2026-01-27', '
国际与地缘

英国首相斯塔默即将访华（打破 8 年僵局）

英国首相斯塔默确认将于 1 月 28 日至 31 日对中国进行正式访问...

消息来源：新华网、澎湃新闻
');
```

SQL 示例文件路径：`src/app/api/world-news/seed-example.sql`

---

如果以上步骤都无法解决问题，请检查浏览器控制台（F12 → Console）中的错误信息，或联系技术支持。
