# 小程序「决行藏」

首页在小程序内打开网站「二」，并尽量用微信身份自动登录。`pages/web-login/` 仍给手机网站一键登录接力，不要删。

## 1. 绑定开放平台（必须）

电脑扫码登录用的是网站应用「一一文化」。小程序必须绑到**同一个微信开放平台账号**，两边才会有相同的 UnionID，铜币和 VIP 才是同一个用户。

## 2. 服务器域名

小程序后台 → 开发 → 开发管理 → 开发设置：

- **request 合法域名**：`https://www.the-one-and-the-two.com`
- **业务域名**：`https://www.the-one-and-the-two.com`（首页 web-view 必须有）

## 3. 网站环境变量

```dotenv
WECHAT_MINIPROGRAM_APP_ID=小程序AppID
WECHAT_MINIPROGRAM_APP_SECRET=小程序AppSecret
```

## 4. 发布

用 `upload-ci.cjs` 或微信开发者工具上传后，提交审核并发布。未发布的新版本，用户打开的仍是上一版。

## 5. 数据库

生产库需有 `wechat_login_tickets` 与 `wechat_identities`。
