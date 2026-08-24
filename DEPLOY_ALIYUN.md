# 阿里云 Ubuntu 24.04 生产环境部署说明

本文只描述部署方案和操作顺序，不要求现在执行。当前项目应继续保留 Vercel 作为开发/测试环境，阿里云 Ubuntu 24.04 作为国内生产环境。

## 1. 当前项目结论

- 技术栈：Next.js 16 App Router、React 19、Node.js、TypeScript、Supabase、OpenAI 兼容 AI 接口、Capacitor Android。
- 生产运行方式：必须运行 `next start`，不能按纯静态站部署。
- 推荐生产架构：Nginx 反向代理到 Docker Compose 中的 Next.js 容器。
- 当前没有发现 Vercel KV、Vercel Blob、Vercel Cron、Vercel Analytics 等专有依赖。
- 项目使用了 Next middleware 和 Route Handlers。迁移到自建 Ubuntu 可以运行，但要用完整 Next Node 服务。

## 2. 服务器基础要求

- Ubuntu 24.04 LTS
- Docker Engine 和 Docker Compose v2
- Nginx 由 `docker-compose.yml` 中的容器提供
- 域名已解析到阿里云服务器公网 IP
- 国内正式上线前完成 ICP 备案
- HTTPS 证书建议使用 Certbot、阿里云证书服务或其他 ACME 客户端

## 3. 生产环境变量

复制模板后填写真实值：

```bash
cp .env.production.example .env.production
```

注意：

- 不要提交 `.env.production`。
- `NEXT_PUBLIC_*` 变量会进入浏览器包，构建镜像时必须提供。
- `SUPABASE_SERVICE_ROLE_KEY`、AI Key、支付密钥只能放在服务器环境变量中。

当前必须配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_API_KEY`
- `AI_BASE_URL`

如果通过 GitHub Actions 自动部署，还需要在仓库的 Actions variables 中设置：

- `OPERATOR_NAME`：与营业执照、支付宝签约主体一致的运营者全称
- `CUSTOMER_SERVICE_EMAIL`：页面公开展示的客服邮箱
- `ICP_NUMBER`：ICP备案号；未取得时留空，不要填写占位内容
- `PUBLIC_SECURITY_NUMBER`：公安联网备案号；未取得时留空

建议配置：

- `NEXT_PUBLIC_SITE_URL`
- `AI_MODEL_NAME`
- `AI_REASONER_MODEL_NAME`
- `TAVILY_API_KEY`
- `NEXT_PUBLIC_OPERATOR_NAME`
- `NEXT_PUBLIC_CUSTOMER_SERVICE_EMAIL`
- `NEXT_PUBLIC_ICP_NUMBER`
- `NEXT_PUBLIC_PUBLIC_SECURITY_NUMBER`

微信网站扫码登录需要额外配置：

- `WECHAT_LOGIN_APP_ID`：微信开放平台中审核通过的“网站应用” AppID
- `WECHAT_LOGIN_APP_SECRET`：对应网站应用的 AppSecret，仅放在服务器环境变量中

微信登录授权回调地址固定为：

- `https://www.the-one-and-the-two.com/api/auth/wechat/callback`

在微信开放平台填写授权回调域时只填写域名 `www.the-one-and-the-two.com`，不要填写协议或路径。微信支付使用的商户密钥不能代替上述登录参数。

支付宝电脑网站支付需要额外配置：

- `ALIPAY_APP_ID`
- `ALIPAY_SELLER_ID`
- `ALIPAY_PRIVATE_KEY_BASE64`
- `ALIPAY_PUBLIC_KEY_BASE64`
- `ALIPAY_KEY_TYPE`（支付宝密钥工具默认通常为 `PKCS8`）
- 沙箱测试时可选 `ALIPAY_GATEWAY`，生产环境留空

宗师模式只使用原备用通道，需要配置：

- `AI_MEDITATION_FALLBACK_API_KEY`
- `AI_MEDITATION_FALLBACK_BASE_URL`
- `AI_MEDITATION_FALLBACK_MODEL_NAME`

## 4. Supabase 设置

生产域名确定后，在 Supabase Authentication URL Configuration 中更新：

- Site URL：`https://你的生产域名`
- Redirect URLs：`https://你的生产域名/auth/callback`

如果继续保留 Vercel 作为开发/测试环境，也要保留 Vercel 域名的回调地址。

## 5. Nginx 配置

修改 `nginx.conf`：

```nginx
server_name example.com www.example.com;
```

替换为备案后的真实域名。

首次上 HTTPS 前可以只开放 80。证书安装完成后，再增加 443 server block，并把 80 重定向到 HTTPS。

## 6. 构建和启动命令

在服务器上，进入项目目录并确保 `.env.production` 已填写后：

```bash
docker compose --env-file .env.production up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs -f app
```

更新版本时重新拉取代码后执行：

```bash
docker compose --env-file .env.production up -d --build
```

## 7. ICP 与国内支付准备

正式面向中国大陆用户访问前，需要：

- 完成 ICP 备案，域名主体与服务内容保持一致。
- 微信支付 Native：准备商户号、AppID、API v3 key、商户私钥、证书序列号、回调通知 URL。
- 支付宝电脑网站支付：准备 AppID、应用私钥、支付宝公钥、异步通知 URL、回跳 URL。
- 支付回调必须使用公网 HTTPS 地址。
- 支付回调接口需要验签、幂等处理、订单状态机和金额校验。

当前代码已实现支付宝电脑网站支付下单、异步验签、金额与商户校验、订单幂等入账。Supabase 支付订单迁移已经应用到当前生产项目；正式交易前仍需在服务器配置支付宝应用参数，并用支付宝沙箱或小额真实订单完成一次端到端验收。

支付回调地址固定为：

- `https://你的生产域名/api/payments/alipay/notify`

支付完成返回页面为：

- `https://你的生产域名/shop`

## 8. 上线前检查清单

- `npm run build` 在本地和服务器均通过。
- Supabase 表结构已迁移到生产项目。
- Supabase Auth 回调地址包含阿里云生产域名和 Vercel 测试域名。
- Nginx `server_name` 已替换为真实域名。
- `.env.production` 中没有遗漏必需变量。
- 服务器安全组开放 80/443，不直接暴露 3000。
- HTTPS 证书生效后再接入支付回调。
- 日志、备份、监控、告警策略已确定。
