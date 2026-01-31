# Android 配置命令清单（逐条执行）

## 准备工作

确保你已经：
- ✅ 安装了 Node.js 和 npm
- ✅ 安装了 Android Studio
- ✅ 有可用的生产环境域名（如 https://your-domain.com）

---

## 命令清单（按顺序复制执行）

### 1️⃣ 安装 Capacitor 依赖

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

**说明**：安装 Capacitor 核心库、CLI 工具和 Android 平台支持。

---

### 2️⃣ 初始化 Capacitor

```bash
npx cap init "The One" "com.theone.app" --web-dir=out
```

**说明**：
- `"The One"` - 应用显示名称
- `"com.theone.app"` - Android 包名（建议改成你的域名反写）
- `--web-dir=out` - Next.js 静态导出目录

**可选修改**：如果你有自己的域名，建议改包名，例如：
```bash
npx cap init "二" "com.yourdomain.er" --web-dir=out
```

---

### 3️⃣ 修改 Next.js 配置

**手动编辑** `next.config.ts` 文件，修改为：

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',  // 添加这一行：启用静态导出
  images: {
    unoptimized: true,  // 添加这一行：静态导出需要
  },
  // 保留你现有的其他配置
};

export default nextConfig;
```

---

### 4️⃣ 构建静态网站

```bash
npm run build
```

**说明**：构建 Next.js 应用，生成 `out/` 目录。
**预期结果**：看到 "Export successful" 或类似成功信息。

---

### 5️⃣ 添加 Android 平台

```bash
npx cap add android
```

**说明**：在项目根目录创建 `android/` 文件夹。
**预期结果**：可以看到新创建的 `android/` 目录。

---

### 6️⃣ 配置在线加载模式

**手动创建/编辑** `capacitor.config.ts` 文件（项目根目录）：

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.theone.app',  // 与步骤2的包名一致
  appName: 'The One',        // 与步骤2的应用名一致
  webDir: 'out',
  
  // 🔥 核心配置：在线加载模式
  server: {
    url: 'https://your-production-domain.com',  // ⚠️ 改成你的实际域名
    cleartext: false,  // HTTPS 用 false，HTTP 用 true
    androidScheme: 'https'
  },

  android: {
    allowMixedContent: true,
  }
};

export default config;
```

**重要提示**：
- **必须修改** `server.url` 为你的实际域名（例如：`https://the-one.vercel.app`）
- 如果是本地测试，可以暂时用 `http://192.168.x.x:3000`（你电脑的局域网IP）

---

### 7️⃣ 同步配置到 Android

```bash
npx cap sync android
```

**说明**：将配置和资源同步到 Android 项目。
**预期结果**：看到 "Syncing web assets" 和 "Updating Android plugins" 成功信息。

---

### 8️⃣ 打开 Android Studio

```bash
npx cap open android
```

**说明**：自动打开 Android Studio 并加载项目。

---

## 在 Android Studio 中操作

### 首次打开

1. **等待 Gradle 同步**
   - 底部会显示 "Gradle Build Running..."
   - 首次可能需要 5-10 分钟下载依赖
   - ☕ 喝杯茶，耐心等待

2. **解决可能的错误**
   - 如果提示 SDK 版本问题，点击 "Install missing SDK packages"
   - 如果提示 Java 版本，File → Project Structure → SDK 选择 JDK 17

### 运行应用（测试）

1. **连接设备**
   - 真机：USB 连接 + 开启 USB 调试
   - 或使用模拟器：Tools → Device Manager → Create Device

2. **运行**
   - 点击顶部绿色播放按钮 ▶️
   - 或按快捷键：`Shift + F10`
   - 选择目标设备
   - 等待安装和启动

### 构建 APK

1. **Debug 版本（测试用）**
   ```
   Build → Build Bundle(s) / APK(s) → Build APK(s)
   ```
   
   生成位置：
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

2. **复制到 public 目录**（供网站下载）
   ```bash
   cp android/app/build/outputs/apk/debug/app-debug.apk public/app-release.apk
   ```

3. **Release 版本（正式发布）**
   - 需要先生成签名密钥
   - 详见 `CAPACITOR_ANDROID_SETUP.md` 的签名章节

---

## 验证在线加载

1. **安装 APK 到手机**
2. **打开应用**
3. **检查是否加载了你的网站内容**
4. **在浏览器中修改网站**
5. **重新打开 App，应该看到更新后的内容**

---

## 常见命令总结

```bash
# 同步更新（修改配置后运行）
npx cap sync android

# 重新打开 Android Studio
npx cap open android

# 查看 Capacitor 状态
npx cap doctor

# 更新 Capacitor 版本
npm update @capacitor/core @capacitor/cli @capacitor/android
```

---

## 故障排查

### 问题 1: Gradle 同步失败

**解决方法**：
```bash
# 清理并重新同步
cd android
./gradlew clean
cd ..
npx cap sync android
```

### 问题 2: App 打开白屏

**检查**：
1. `capacitor.config.ts` 中的 URL 是否正确
2. 网站是否可以正常访问
3. 手机是否联网
4. 在 Chrome 浏览器打开 `chrome://inspect` 查看错误信息

### 问题 3: 本地测试连接不上

**解决方法**：
1. 确保手机和电脑在同一 WiFi
2. 获取电脑 IP：
   ```bash
   # Mac/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```
3. 修改 `capacitor.config.ts` 的 URL 为 `http://你的IP:3000`
4. 重新同步：`npx cap sync android`

---

## 快速执行脚本

如果你想一键执行前 5 步（需要手动配置的步骤会暂停提示）：

```bash
./setup-android.sh
```

---

## 完成后的提交

```bash
# 提交 Android 配置
git add .
git commit -m "Add Android Capacitor configuration for live update mode"
git push

# 提交 APK（如果已生成）
git add public/app-release.apk
git commit -m "Add Android APK"
git push
```

---

**下一步**：查看 `CAPACITOR_ANDROID_SETUP.md` 了解更多配置选项和发布流程。
