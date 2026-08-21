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
NEXT_PUBLIC_SITE_URL=https://www.the-one-and-the-two.com
```

不要把 AppSecret 写进 `NEXT_PUBLIC_*` 变量、前端代码或 Git 仓库。微信支付配置与微信登录配置相互独立，不能用商户 API 密钥代替 AppSecret。

## 数据库

部署代码前应用迁移：

`supabase/migrations/20260805084731_create_wechat_identities.sql`

迁移创建的 `wechat_identities` 表启用了 RLS，并撤销了浏览器端 `anon`、`authenticated` 权限，只允许可信服务端维护微信身份映射。

## 用户流程

- 新用户：登录页选择“微信扫码登录”，首次成功后建立新的 Supabase 用户与档案。
- 老用户：先使用原邮箱或用户名登录，在“个人设置”中选择“绑定微信”。
- 已绑定用户：以后扫码会恢复同一个 Supabase 用户，因此铜币、VIP、邀请关系和历史数据不会发生变化。
- 一个微信只能绑定一个账号，一个账号也只能绑定一个微信；系统不会按昵称自动合并用户。

## 上线验收

1. 老账号绑定微信后退出，重新扫码能回到原账号。
2. 原账号的铜币、VIP、聊天和排盘历史保持不变。
3. 全新微信首次扫码获得新用户档案，重复扫码不会重复赠送初始铜币。
4. 已绑定其他账号的微信不能再次绑定。
5. 篡改或复用 `state`、重复使用授权 `code` 时登录失败。
6. 取消扫码、授权超时、微信接口异常时回到登录页并显示可理解的提示。
