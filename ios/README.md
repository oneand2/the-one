# 「二」原生 iOS 工程

这是独立的 SwiftUI 原生应用，不包含 `WKWebView`，也不会加载现有网站页面。它通过 HTTPS API 与现有 Next.js/Supabase 后端共享账户、铜币和记录。

## 首次运行

1. 安装 Xcode 26 或更新版本。
2. 打开 `TheOne.xcodeproj`。
3. 在 Target `TheOne` → Signing & Capabilities 选择 Apple Developer Team。
4. 保持 Bundle ID 为 `com.theone.er`，或在首次上传前同时修改工程、后端环境变量和 StoreKit 商品 ID。
5. 选择 iPhone 模拟器或真机运行。

本地 StoreKit 商品已写入 `TheOne/Configuration.storekit`。服务端测试本地签名时需要临时设置 `APPLE_IAP_ALLOW_XCODE=true`；生产环境不要开启。

## 上线前的服务端环境变量

- `APPLE_BUNDLE_ID=com.theone.er`
- `APPLE_APP_ID`：App Store Connect 创建 App 后生成的数字 Apple ID
- 生产环境不要设置 `APPLE_IAP_ALLOW_XCODE=true`

还需要部署 `supabase/migrations/20260812193000_create_apple_iap_transactions.sql`，并在 Supabase Auth 中启用 Apple Provider。

