# Capacitor Android 打包配置指南（在线加载模式）

## 配置方式说明

**在线加载模式**：App 直接加载你的线上网站（如 https://your-domain.com），这样每次用户打开 App 都会加载最新的网站内容，无需重新发布 App。

### 优点
- 网站更新后，App 自动获取最新内容
- 无需重新打包和发布 App
- 维护成本低

### 缺点  
- 需要网络连接才能使用
- 首次加载可能稍慢

---

## 步骤 1: 安装 Capacitor 依赖

在项目根目录运行：

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

## 步骤 2: 初始化 Capacitor 配置

```bash
npx cap init "The One" "com.theone.app" --web-dir=out
```

参数说明：
- `"The One"` - 应用名称（可修改）
- `"com.theone.app"` - 应用包名（建议使用你的域名反写，如 com.yourdomain.app）
- `--web-dir=out` - Next.js 静态导出的输出目录

## 步骤 3: 修改 Next.js 配置支持静态导出

编辑 `next.config.ts`，添加静态导出配置：

```typescript
const nextConfig = {
  output: 'export',  // 添加这一行
  images: {
    unoptimized: true,  // 静态导出需要
  },
  // ... 其他现有配置
};
```

## 步骤 4: 构建静态网站（用于本地 fallback）

```bash
npm run build
```

注意：即使使用在线加载模式，也建议先构建一次，这样 Android 项目不会报错。

## 步骤 5: 添加 Android 平台

```bash
npx cap add android
```

这会在项目根目录创建 `android/` 文件夹。

## 步骤 6: 配置在线加载模式

编辑 `capacitor.config.ts`（在项目根目录，如果不存在会自动创建）：

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.theone.app',
  appName: 'The One',
  webDir: 'out',
  
  // 核心配置：在线加载模式
  server: {
    url: 'https://your-production-domain.com',  // 替换为你的实际域名
    cleartext: true,  // 如果是 HTTP 需要这个
    androidScheme: 'https'
  },

  android: {
    // 允许网络访问
    allowMixedContent: true,
    // 其他 Android 配置
    buildOptions: {
      // 如果需要签名，可以在这里配置
      // keystorePath: 'path/to/keystore.jks',
      // keystorePassword: 'password',
    }
  }
};

export default config;
```

**重要提示**：
- 将 `url` 改为你的实际生产域名
- 如果是本地测试，可以暂时用：`url: 'http://localhost:3000'`（需要电脑和手机在同一网络）

## 步骤 7: 同步配置到 Android 项目

```bash
npx cap sync android
```

这个命令会：
- 将配置同步到 Android 项目
- 复制 web 资源
- 更新原生依赖

## 步骤 8: 打开 Android Studio

```bash
npx cap open android
```

这会打开 Android Studio 并加载项目。

---

## 在 Android Studio 中的操作

### 首次打开后的配置

1. **等待 Gradle 同步完成**
   - Android Studio 会自动下载依赖，耐心等待
   - 底部状态栏会显示进度

2. **连接设备或启动模拟器**
   - 真机：通过 USB 连接手机，开启开发者模式和 USB 调试
   - 模拟器：Tools → Device Manager → Create Device

3. **运行应用**
   - 点击绿色播放按钮（Run）或按 `Shift + F10`
   - 选择目标设备
   - 等待编译和安装

### 构建发布版 APK

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**

2. 等待构建完成（首次可能需要几分钟）

3. 构建完成后会显示链接，点击 `locate` 查看 APK 文件

4. APK 位置：
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

5. 复制到 public 目录：
   ```bash
   cp android/app/build/outputs/apk/debug/app-debug.apk public/app-release.apk
   ```

---

## 完整命令清单（按顺序执行）

```bash
# 1. 安装依赖
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. 初始化 Capacitor
npx cap init "The One" "com.theone.app" --web-dir=out

# 3. 构建 Next.js（需要先修改 next.config.ts 添加 output: 'export'）
npm run build

# 4. 添加 Android 平台
npx cap add android

# 5. 修改 capacitor.config.ts 配置在线加载模式（手动编辑）

# 6. 同步到 Android
npx cap sync android

# 7. 打开 Android Studio
npx cap open android
```

---

## 本地开发测试（可选）

如果想在打包前测试在线加载模式：

```bash
# 1. 启动开发服务器
npm run dev

# 2. 获取本机 IP（Mac/Linux）
ifconfig | grep "inet " | grep -v 127.0.0.1

# 3. 修改 capacitor.config.ts 的 server.url 为：
# url: 'http://你的IP:3000'  例如 'http://192.168.1.100:3000'

# 4. 同步并运行
npx cap sync android
npx cap open android
```

---

## 常见问题

### Q1: 在线加载模式下，离线能用吗？
**A:** 不能。需要网络连接。如果需要离线支持，考虑使用 Service Worker 或混合模式。

### Q2: 如何切换回本地打包模式？
**A:** 从 `capacitor.config.ts` 中删除 `server.url` 配置，然后运行 `npx cap sync android`。

### Q3: Android Studio 同步失败怎么办？
**A:** 
1. 确保网络连接正常（需要下载 Gradle）
2. 重启 Android Studio
3. File → Invalidate Caches → Invalidate and Restart

### Q4: 如何生成签名的发布版 APK？
**A:** 需要创建签名密钥，详见下一节。

---

## 生成签名发布版 APK（生产环境）

### 1. 创建签名密钥

```bash
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
```

### 2. 配置签名

编辑 `android/app/build.gradle`：

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('../../my-release-key.jks')
            storePassword 'your-password'
            keyAlias 'my-key-alias'
            keyPassword 'your-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 3. 构建签名 APK

在 Android Studio 中：
- Build → Generate Signed Bundle / APK
- 选择 APK
- 选择密钥文件和密码
- 选择 release 构建类型

---

## 更新流程

使用在线加载模式后，更新流程变得非常简单：

```bash
# 1. 修改网站代码
# 2. 提交到 Git
git add .
git commit -m "Update website"
git push

# 3. 部署到生产环境（如 Vercel）
# Vercel 会自动部署

# 4. 用户打开 App 时自动加载最新内容！
# 无需重新打包和发布 App
```

---

## 注意事项

1. **域名配置**：确保 `capacitor.config.ts` 中的 URL 指向你的生产域名
2. **HTTPS**：生产环境强烈建议使用 HTTPS
3. **性能**：在线加载模式首次打开可能稍慢，建议优化网站加载速度
4. **调试**：可以在 Chrome 中使用 `chrome://inspect` 调试 Android App 中的网页
5. **权限**：如需使用相机、定位等原生功能，需要额外配置权限

---

## 下一步

完成上述配置后：
1. 在 Android Studio 中测试运行
2. 验证 App 能正常加载你的网站
3. 构建 APK
4. 复制到 `public/app-release.apk`
5. 提交代码并部署
