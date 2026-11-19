This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 「我的古典排盘」与「我的八维结果」所用表

后端统一使用 **`daoyoushuju`** 一张表，通过 **`type`** 区分类型（`classical_bazi` 八字排盘、`mbti` 八维结果），详情存入 **`input_data`**（JSONB）。请确保该表存在且含字段：`id`、`user_id`、`type`、`input_data`、`created_at`。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 生产部署

提交到 `main` 后，GitHub Actions 自动将精简 Docker 镜像发布到阿里云 ECS，并在健康检查通过后平滑切换。详见 [生产发布、回滚和测量说明](docs/production-deployment.md)。

## 每日内容自动化

三个工作流在 GitHub 托管运行器上按北京时间运行，不依赖个人电脑。计划任务可能晚几分钟到几小时才开始；同一工作流若上一轮还在跑，下一轮会排队，不会把正在发布的一轮取消。《见天地》迟到时仍使用提示词里的固定截稿窗口。

| 北京时间 | UTC cron | 工作流 | 结果 |
| --- | --- | --- | --- |
| 03:00 | `0 19 * * *`（前一日） | 每日续写见众生 | 续写 `src/content/jianzhongsheng.ts`，推送 `main`，再部署 |
| 07:00 | `0 23 * * *`（前一日） | 今日见闻 | 核对或新写七天周稿；推送后部署，再写入 `daily_insights` |
| 08:00 | `0 0 * * *` | 《见天地》新闻 | 直接写入 Supabase 与图片桶，不提交 Git、不部署网站 |

编刊规则在 `.github/automation/prompts/`。手动运行：打开 Actions，选择对应工作流，在 `main` 上 Run workflow。

模型步骤由 `scripts/automation/openai_content_runner.py` 调用 OpenAI Responses API（`https://api.openai.com/v1/responses`），不经过 Codex。默认模型是 `gpt-6.2-sol`，推理强度 `high`，写在工作流的 `CONTENT_MODEL` 和 `CONTENT_REASONING_EFFORT` 里，不是新的 secret。运行器把托管 `web_search`、本地 shell 和 `apply_patch` 串成工具循环：模型可以读仓库、检索并打开公开页面、改允许的文件、运行检查和出刊脚本；提交、推送、部署和见闻入库仍由原来的后续步骤完成。《见天地》继续只写入 Supabase 和图片桶。shell 子进程拿不到 API 密钥、GitHub 令牌和 Supabase 密钥。

需要配置的 Actions secrets：

- `OPENAI_API_KEY`：三个任务的 Responses API，包括托管网页检索。不需要另配搜索密钥。
- `NEXT_PUBLIC_SUPABASE_URL`：今日见闻与《见天地》
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：今日见闻只读核对
- `SUPABASE_SERVICE_ROLE_KEY`：今日见闻入库与《见天地》出刊

应用聊天用的 `AI_*`、`TAVILY_API_KEY` 和 `NEXT_PUBLIC_SITE_URL` 不参与这三项任务。日志和工作流摘要不打印密钥。

仓库设置：

- Settings → Actions → General → Workflow permissions 设为 Read and write。工作流声明了 `contents: write` 与 `actions: write`；若仓库把令牌限制为只读，推送和触发部署会被拒绝。
- `main` 若有分支保护，需要允许 `github-actions[bot]` 直接推送。提交身份是 `github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>`。
- 不需要额外的 PAT。

`GITHUB_TOKEN` 推送到 `main` 不会触发 `Deploy to Aliyun` 的 `push` 事件。见众生与今日见闻推送成功后，用同一个令牌调用该工作流的 `workflow_dispatch`。`scripts/deploy/plan-release.py` 把手动触发视为完整发布，任务会等到线上 `/api/health` 的版本包含这次提交。新闻不走这条部署。
