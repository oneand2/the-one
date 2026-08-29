# 微信网站扫码登录配置

## 申请入口

开发文档站 `developers.weixin.qq.com` 只提供接口说明，没有申请按钮。

1. 打开 [微信开放平台](https://open.weixin.qq.com/) 并登录。
2. 进入“管理中心”。
3. 选择“网站应用”。
4. 选择“创建网站应用”，按页面要求提交主体、网站和应用资料。
5. 网站应用审核通过后，申请“微信登录”能力并取得 AppID、AppSecret。

网站名称、备案主体、域名和实际运营信息应保持一致。审核入口或字段名称以后若有调整，以开放平台管理中心实际页面为准。

## 微信开放平台配置

- 授权回调域：`www.the-one-and-the-two.com`
- 程序实际回调地址：`https://www.the-one-and-the-two.com/api/auth/wechat/callback`
- 网页授权作用域：`snsapi_login`

授权回调域只填写域名，不包含 `https://`，也不包含 `/api/auth/wechat/callback` 路径。

## 服务器环境变量

在 GitHub 仓库的 Actions secrets 中增加（部署时会写入生产 `.env.production`）：

```dotenv
WECHAT_LOGIN_APP_ID=网站应用的AppID
WECHAT_LOGIN_APP_SECRET=网站应用的AppSecret
WECHAT_MINIPROGRAM_APP_ID=小程序AppID
WECHAT_MINIPROGRAM_APP_SECRET=小程序AppSecret
NEXT_PUBLIC_SITE_URL=https://www.the-one-and-the-two.com
```

不要把 AppSecret 写进 `NEXT_PUBLIC_*` 变量、前端代码或 Git 仓库。微信支付配置与微信登录配置相互独立，不能用商户 API 密钥代替 AppSecret。

## 数据库

部署代码前应用迁移：

`supabase/migrations/20260805084731_create_wechat_identities.sql`
`supabase/migrations/20260829143000_create_wechat_login_tickets.sql`

两张表都启用了 RLS，并撤销了浏览器端 `anon`、`authenticated` 权限，只允许可信服务端维护微信身份映射与登录票据。

## 用户流程

- 电脑 / Safari：登录页选择“微信扫码登录”，走网站应用二维码。
- 手机微信内打开网站：登录页变为“微信一键登录”，跳转小程序「决行藏」确认身份后回到网站。
- 新用户：首次成功后建立新的 Supabase 用户与档案。
- 老用户：先使用原邮箱或用户名登录，在“个人设置”中选择“绑定微信”。
- 已绑定用户：以后微信登录会恢复同一个 Supabase 用户，因此铜币、VIP、邀请关系和历史数据不会发生变化。
- 一个微信只能绑定一个账号，一个账号也只能绑定一个微信；系统不会按昵称自动合并用户。

电脑扫码与微信内小程序登录要对齐到同一账号，必须把小程序「决行藏」绑定到和网站应用「一一文化」同一个开放平台账号，以共用 UnionID。操作说明见 `wechat-miniprogram/README.md`。

## 微信内小程序接力

额外环境变量：

```dotenv
WECHAT_MINIPROGRAM_APP_ID=小程序AppID
WECHAT_MINIPROGRAM_APP_SECRET=小程序AppSecret
```

并执行迁移 `supabase/migrations/20260829143000_create_wechat_login_tickets.sql`。

## 上线验收

1. 老账号绑定微信后退出，电脑重新扫码能回到原账号。
2. 同一微信在手机微信内打开网站，一键登录进入同一账号。
3. 原账号的铜币、VIP、聊天和排盘历史保持不变。
4. 全新微信首次登录获得新用户档案，重复登录不会重复赠送初始铜币。
5. 已绑定其他账号的微信不能再次绑定。
6. 篡改或复用 `state`、重复使用授权 `code` / 小程序 `ticket` 时登录失败。
7. 取消扫码、关闭小程序、授权超时、微信接口异常时回到登录页并显示可理解的提示。
