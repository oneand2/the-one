# 网页发布指南

你的项目是 **Next.js 16 + Supabase**，推荐用 **Vercel** 部署，和 Next.js 同源、零配置。

---

## 一、用 Vercel 部署（推荐）

### 1. 前置准备

- 代码在 **GitHub / GitLab / Bitbucket** 任一仓库里
- 已有 [Vercel 账号](https://vercel.com/signup)（可用 GitHub 登录）

### 2. 从仓库创建项目

1. 打开 [vercel.com/new](https://vercel.com/new)
2. **Import** 你的 `the-one` 仓库
3. **Framework Preset** 选 **Next.js**（一般会自动识别）
4. **Root Directory** 保持默认（项目根目录）
5. 先不点 Deploy，到下一步配环境变量

### 3. 配置环境变量

在 Vercel 项目里打开 **Settings → Environment Variables**，按你本地 `.env.local` 配置下面变量（部署用「Production」即可）：

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名公钥 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥（auth callback、管理接口等） | ✅ |
| `NEXT_PUBLIC_SITE_URL` | 线上站点的完整地址，如 `https://你的域名.vercel.app` | 建议填，用于登录回调 |
| `AI_API_KEY` | 大模型 API Key（chat/解卦等） | 若用到 AI 则必填 |
| `AI_BASE_URL` | 大模型 API 的 base URL | 若用自建/第三方则填 |
| `AI_MODEL_NAME` | 默认模型名 | 可选 |
| `AI_REASONER_MODEL_NAME` | 推理模型名 | 可选 |
| `TAVILY_API_KEY` | Tavily 搜索（若用联网搜索） | 可选 |

注意：**不要**把 `.env.local` 提交到 Git，只在 Vercel 里手动填上述变量。

### 4. 部署

1. 保存环境变量后，在 **Deployments** 里点 **Redeploy**，或重新从 **Import** 流程走一遍并点 **Deploy**。
2. 等构建完成，会得到一个 `https://xxx.vercel.app` 的地址。

### 5. Supabase 里配置回调地址

在 [Supabase Dashboard](https://supabase.com/dashboard) → 你的项目 → **Authentication → URL Configuration** 里：

- **Site URL**：填 `https://你的域名.vercel.app`（或你绑定的自定义域名）
- **Redirect URLs** 里新增：
  - `https://你的域名.vercel.app/auth/callback`
  - 若用自定义域名，再加 `https://你的自定义域名/auth/callback`

保存后，登录、注册和“去登录”跳转才会正常。

### 6. 自定义域名（可选）

在 Vercel 项目 **Settings → Domains** 里添加你的域名，按提示在域名服务商处加 CNAME 或 A 记录即可。

---

## 二、其它部署方式简述

- **Netlify**：也支持 Next.js，在站点里绑同一个 Git 仓库，在 **Site settings → Environment variables** 里把上面那一组变量填进去，并在 Netlify 里把 **Build command** 设为 `npm run build`、**Publish directory** 设为 `.next`（或按 Netlify 对 Next 的默认即可）。
- **自建服务器 / Docker**：在服务器上执行 `npm run build && npm run start`，用 Nginx/Caddy 反向代理到 `localhost:3000`；环境变量通过 `export` 或 `.env.production` 等方式注入，同样需要配置 `NEXT_PUBLIC_SITE_URL` 和 Supabase 回调 URL。

---

## 三、发布前自检

1. **构建通过**：在本地执行 `npm run build`，确认无报错。
2. **环境变量齐全**：尤其是 `NEXT_PUBLIC_SUPABASE_*` 和 `SUPABASE_SERVICE_ROLE_KEY`，否则登录或 Auth callback 会失败。
3. **Supabase 回调**：线上域名配好后，务必在 Supabase 的 **Redirect URLs** 里加上 `https://你的域名/auth/callback`。

按上述步骤做完后，你的网页就可以通过 Vercel 的链接（或自定义域名）对外访问了。
