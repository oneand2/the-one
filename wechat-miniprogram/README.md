# 小程序「决行藏」网站登录接力页

把本目录里的 `pages/web-login/` 整夹复制进已上线的小程序「决行藏」，不要新建另一个小程序。

## 1. 绑定开放平台（必须）

电脑扫码登录用的是网站应用「一一文化」。小程序必须绑到**同一个微信开放平台账号**，两边才会有相同的 UnionID，铜币和 VIP 才是同一个用户。

1. 打开 [微信开放平台](https://open.weixin.qq.com/) → 管理中心 → 绑定公众号/小程序。
2. 把「决行藏」绑上去（主体需与「一一文化」一致）。

未绑定则手机登录会变成另一套账号。

## 2. 复制页面

在小程序 `app.json` 的 `pages` 里加上，且不要放在第一项（避免影响现有首页）：

```json
"pages/web-login/index",
"pages/web-login/webview"
```

## 3. 服务器域名

小程序后台 → 开发 → 开发管理 → 开发设置：

- **request 合法域名**：`https://www.the-one-and-the-two.com`
- **业务域名**（可选，用于「返回网站」）：`https://www.the-one-and-the-two.com`

业务域名需要把微信提供的校验文件放到网站 `public/` 后再提交。没有业务域名时，用户确认后关闭小程序即可回到网站。

## 4. 网站环境变量

从同一页复制 AppID、AppSecret，写入服务器：

```dotenv
WECHAT_MINIPROGRAM_APP_ID=小程序AppID
WECHAT_MINIPROGRAM_APP_SECRET=小程序AppSecret
```

不要提交到 Git。上传代码后若 GitHub Secrets 里也加上同名项，以后部署会自动写入。

## 5. 发布

用微信开发者工具上传，提交审核并发布。未发布时，网站生成的跳转链接打不开这一页。

## 6. 数据库

在生产库执行 `supabase/migrations/20260829143000_create_wechat_login_tickets.sql`。
