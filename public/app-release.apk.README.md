# Android APK 文件说明

此目录应放置构建好的 Android APK 文件：`app-release.apk`

## 如何生成 APK

如果您使用 React Native、Capacitor 或其他框架构建移动应用：

### Capacitor 方式（推荐用于 Next.js PWA）

```bash
# 1. 安装 Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. 初始化 Capacitor
npx cap init

# 3. 构建 web 应用
npm run build

# 4. 添加 Android 平台
npx cap add android

# 5. 同步文件
npx cap sync

# 6. 在 Android Studio 中打开项目
npx cap open android

# 7. 在 Android Studio 中构建 APK
# Build -> Build Bundle(s) / APK(s) -> Build APK(s)
```

生成的 APK 通常位于：
`android/app/build/outputs/apk/release/app-release.apk`

将此文件复制到 `public/app-release.apk` 即可。

## 临时方案

如果暂时没有 APK 文件，下载页面会尝试下载 `/app-release.apk`，
用户会看到 404 错误。建议在准备好 APK 之前，可以：

1. 在下载页面暂时隐藏 Android 下载部分
2. 或者在按钮上添加"即将推出"的提示
