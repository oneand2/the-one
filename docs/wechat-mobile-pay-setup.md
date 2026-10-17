# 手机网页微信支付

## 当前核验结果（2026-10-16）

用户提供的商户后台截图显示：H5支付产品权限被驳回，原因为「目前该类业务形态暂不支持开通 H5 支付进行收款，请使用其他支付方式」。这是产品权限限制，修改代码或域名不能解决。H5 开关保持关闭；不能通过更换接口、AppID 或虚假经营内容绕过审核。用户另行确认 JSAPI 支付已开通；AppID 账号列表截图只有「决行藏」小程序，没有已关联的公众号。用户随后找到显示为「新注册公众号」的服务号；账号详情截图明确显示「认证情况：未认证」。需要用户先完成微信认证，再核实主体、关联 AppID 和配置域名。目前未具备启用网页 JSAPI 的条件。

浏览器工具的站点安全策略禁止访问商户后台和公众平台，未代为提交申请、绑定 AppID 或修改域名。本文是待配置清单，不代表后台已完成设置。

2026-10-17：用户表示微信认证可能已通过，并要求继续配置。目前尚未取得新的认证状态证据或服务号开发者 AppID，不能将「可能通过」记为已核验。网站的移动支付修改仍在本地，JSAPI 未启用；需确认认证结果、完成商户号关联与域名设置，并将公众号凭据通过安全渠道配置到服务器后再发布验收。

同日后续截图已确认：服务号名称「决行藏」，认证情况为「微信认证」并带认证标记；服务号开发者 AppID 为 `wx1016c194159c39c9`（不是此前关联的小程序 AppID）。该 AppID 已保存到本地被 Git 忽略的 `.env.local`，不代表已写入生产配置。商户号关联、网页授权域名、支付授权目录和服务号 AppSecret 尚未配置核验，JSAPI 仍未启用。

同日关联进展：用户已提交该服务号的商户号关联申请，截图显示「待授权」；随后用户确认已在服务号侧完成授权。下一步取得并部署公众号网页授权域名的真实校验文件，配置授权域名及支付授权目录；网站 `public/` 中尚未找到该校验文件，本地尚未配置服务号 AppSecret，未启用 JSAPI。

用户提供的校验文件已原样加入 `public/MP_verify_b3ecDrlTcrT8ILYY.txt`，目标公开地址为 `https://www.the-one-and-the-two.com/MP_verify_b3ecDrlTcrT8ILYY.txt`。此文件用于在公众平台完成域名验证；部署文件本身不会启用 JSAPI，也不会代替服务器的公众号 AppSecret 配置。

## 自动选择

网站服务端以 User-Agent 判断环境；前端补充 iPad 桌面 UA 的触摸设备提示，不用窗口宽度判断手机。

| 环境 | 已批准并配置时 | 未启用时 |
| --- | --- | --- |
| 手机微信浏览器 | JSAPI：直接弹出微信收银台 | Native 二维码，并说明需另一台设备展示或选支付宝 |
| Safari、Chrome 等手机浏览器 | H5：跳转微信官方支付链接 | 同上 |
| 电脑浏览器、电脑微信、企业微信 | Native 扫码 | Native 扫码 |

企业微信单独接入不在此变更范围；微信内不会降级到 H5。不能把 Native 二维码里的 `weixin://wxpay/` 链接直接当成通用手机付款链接。

## 服务器配置

复用现有 Native 的商户号、API v3 密钥、商户签名私钥、微信支付验签公钥和通知地址。新增参数只放服务器环境，不进入 `NEXT_PUBLIC_*` 或 Git 仓库。

```
WECHAT_PAY_H5_ENABLED=false
WECHAT_PAY_JSAPI_ENABLED=false
WECHAT_PAY_JSAPI_APP_ID=
WECHAT_PAY_JSAPI_APP_SECRET=
```

开关只表示运营方已核验产品权限，不是微信权限查询接口。只有产品审批和域名配置均完成、真机验收通过后才设为 `true`。运行中的配置由现有生产环境管理；改示例文件不会更新生产配置。

现有 GitHub Actions 已支持通过 repository Variables 设置两项 `*_ENABLED` 开关（字符串 `true` / `false`），通过 Secrets 设置 `WECHAT_PAY_JSAPI_APP_ID` 和 `WECHAT_PAY_JSAPI_APP_SECRET`。空值不会覆盖服务器已有配置；显式关闭应填 `false`。未修改 GitHub 或生产服务器上的实际配置。

## JSAPI 待配置项

1. 商户平台「产品中心 → JSAPI支付」确认权限；未开通时按真实经营内容申请。若出现协议签署、身份认证或付款，交由商户管理员完成。
2. 准备已认证服务号（或微信官方支持的已认证政府、媒体类型公众号），将其 AppID 与现有商户号关联，并在公众号侧确认。网站微信扫码登录 AppID、小程序 AppID、公众号网页支付 AppID 各自独立；不能直接复用不同应用取得的 OpenID。
3. 公众平台配置网页授权域名：`www.the-one-and-the-two.com`。需要的域名校验文件由平台真实生成后放网站根目录，不能编造。
4. 商户平台「产品中心 → 开发配置 → JSAPI支付 → 支付授权目录」配置 `https://www.the-one-and-the-two.com/`，覆盖当前 `/shop` 付款页；按平台实际授权目录要求核验。
5. 将该公众号 AppID、AppSecret 写入服务器的 `WECHAT_PAY_JSAPI_APP_ID`、`WECHAT_PAY_JSAPI_APP_SECRET`。AppSecret 不发送到聊天、前端或日志。配置齐全后启用 JSAPI 开关并真机验收。

网页授权回调为 `https://www.the-one-and-the-two.com/api/payments/wechat/authorize/callback`，使用 `snsapi_base` 取得付款 OpenID，不请求昵称或头像，不创建或切换网站账号。付款身份保存在加密、HttpOnly Cookie 中，绑定当前登录用户和公众号 AppID，最长一小时。OAuth state 与购买意向有效十分钟。授权回跳只恢复同一标签页里用户刚才已同意规则并点击的购买；无购买意向时不会自动下单。

## H5 待审批通过后配置

当前不启用。若以后按真实业务重新申请并获准，在商户平台「产品中心 → 开发配置 → H5支付」配置完整域名 `www.the-one-and-the-two.com`，根据平台要求提供真实资质。域名获批后才启用 H5 开关。

H5 的 `payer_client_ip` 取生产 Nginx 覆盖的 `X-Real-IP`，不取可被客户端伪造的 `X-Forwarded-For` 首项。不要移除现有 Nginx 的 `proxy_set_header X-Real-IP $remote_addr`；应用端口继续保持只由可信反代访问。

## 验收

- 无配置：桌面仍生成 Native 二维码；手机显示扫码限制与支付宝选择，不向未开通产品下单。
- 微信内：首次付款完成网页授权后调起收银台；取消时可继续支付原订单，不自动重建订单。
- H5：外部手机浏览器调起微信并返回同一订单；点击「确认支付结果」查单，回跳本身不表示支付成功。
- 取消、网络超时和十五分钟过期时有明确提示；过期后仍能确认已付款订单。接口超时保留本地订单，接收可能已支付的异步通知。
- 前端每次明确购买生成 `attemptId`；同一请求重试由账户、商品、购买意向推导同一订单号，并由数据库唯一键防止重复下单。另一次明确购买仍生成新订单。
- JSAPI Bridge 返回 `ok` 仅提示正在确认，只有服务端查到 `paid` 且 `credited_at` 存在才显示到账。Native、H5 和 JSAPI 共用原验签、商户/金额校验及幂等入账。
- 用商户本人真机进行受控小额交易，确认铜币/会员到账、取消不入账、重复通知不重复入账。自动化只使用隔离替身，不创建真实支付或扣款。

官方参考：[JSAPI开发准备](https://pay.wechatpay.cn/doc/v3/merchant/4015423216)、[JSAPI开发指引](https://pay.wechatpay.cn/doc/v3/merchant/4012791870)、[H5支付域名](https://pay.wechatpay.cn/doc/v3/merchant/4013287193)、[H5调起与回跳](https://pay.wechatpay.cn/doc/v3/merchant/4012791835)。
