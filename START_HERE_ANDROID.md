# 🚀 开始配置 Android 打包（在线加载模式）

## 第一步：修改配置文件

### 1. 修改 Next.js 配置

将 `next.config.ts` 替换为以下内容（已为你准备好）：

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  
  // Capacitor 静态导出配置
  output: 'export',
  
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

**快速执行**（复制整个命令）：

```bash
cat > next.config.ts << 'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
EOF
```

---

## 第二步：执行安装和配置命令

**直接复制以下所有命令，粘贴到终端一次性执行：**

```bash
# 1️⃣ 安装 Capacitor 依赖
echo "📦 正在安装 Capacitor..."
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2️⃣ 初始化 Capacitor
echo ""
echo "⚙️  正在初始化 Capacitor..."
npx cap init "二" "com.theone.er" --web-dir=out

# 3️⃣ 构建静态网站
echo ""
echo "🔨 正在构建 Next.js..."
npm run build

# 4️⃣ 添加 Android 平台
echo ""
echo "📱 正在添加 Android 平台..."
npx cap add android

echo ""
echo "✅ 基础配置完成！"
echo "📝 下一步：请配置在线加载模式（见下方）"
```

---

## 第三步：配置在线加载模式

### 创建 Capacitor 配置文件

在项目根目录创建 `capacitor.config.ts` 文件：

**方法 1：使用命令创建**（推荐）

```bash
cat > capacitor.config.ts << 'EOF'
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.theone.er',
  appName: '二',
  webDir: 'out',
  
  // 在线加载模式配置
  server: {
    url: 'https://your-domain.vercel.app',  // ⚠️ 改成你的实际域名
    androidScheme: 'https'
  },

  android: {
    allowMixedContent: true,
  }
};

export default config;
EOF
```

**重要**：执行上述命令后，立即修改 `capacitor.config.ts` 中的 `server.url`：
- 将 `https://your-domain.vercel.app` 改为你的实际域名
- 例如：`https://the-one-xi.vercel.app`

**方法 2：手动创建**

创建 `capacitor.config.ts` 文件，内容如上（记得改域名）。

---

## 第四步：同步并打开 Android Studio

```bash
# 同步配置
npx cap sync android

# 打开 Android Studio
npx cap open android
```

---

## 🎯 完整执行流程（推荐）

**一次性完成所有配置**，只需要按顺序执行以下 3 个代码块：

### 📝 代码块 1：修改 Next.js 配置

```bash
cat > next.config.ts << 'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
EOF
```

### 📦 代码块 2：安装和初始化

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android && \
npx cap init "二" "com.theone.er" --web-dir=out && \
npm run build && \
npx cap add android
```

### ⚙️ 代码块 3：配置在线加载（记得改域名！）

```bash
cat > capacitor.config.ts << 'EOF'
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.theone.er',
  appName: '二',
  webDir: 'out',
  
  server: {
    url: 'https://your-domain.vercel.app',
    androidScheme: 'https'
  },

  android: {
    allowMixedContent: true,
  }
};

export default config;
EOF

# ⚠️ 立即修改上面创建的 capacitor.config.ts 文件
# 将 url 改为你的实际域名，然后执行下面的命令：

# 同步配置
npx cap sync android

# 打开 Android Studio
npx cap open android
```

**⚠️ 重要提醒**：在执行 `npx cap sync android` 之前，务必修改 `capacitor.config.ts` 中的 `server.url`！

---

## 📱 在 Android Studio 中操作

1. **等待 Gradle 同步完成**（首次约 5-10 分钟）
2. **运行应用**：点击绿色播放按钮 ▶️
3. **构建 APK**：
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - 构建完成后，复制 APK：
     ```bash
     cp android/app/build/outputs/apk/debug/app-debug.apk public/app-release.apk
     ```

---

## 🔍 验证在线加载模式

1. 安装 APK 到手机
2. 打开应用，应该看到你的网站内容
3. 在网站上做个小修改（如改个文字）
4. 部署更新到服务器
5. 重新打开 App，应该看到更新后的内容 ✅

---

## 📚 详细文档

- **完整配置说明**：`CAPACITOR_ANDROID_SETUP.md`
- **命令清单**：`ANDROID_COMMANDS.md`
- **故障排查**：见上述文档的故障排查章节

---

## ❓ 常见问题

### Q: 如何获取我的 Vercel 域名？

**A:** 
1. 登录 Vercel 控制台
2. 找到你的项目
3. 复制 "Domains" 下的域名（通常是 `your-project.vercel.app`）

### Q: 本地测试怎么配置？

**A:** 将 `server.url` 改为你的局域网 IP：
```bash
# 获取 IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# 修改 capacitor.config.ts 为：
url: 'http://192.168.x.x:3000'
```

### Q: 构建失败怎么办？

**A:** 
```bash
# 清理并重建
rm -rf out android
npm run build
npx cap add android
npx cap sync android
```

---

## ✅ 完成检查清单

- [ ] 修改了 `next.config.ts`（添加 `output: 'export'`）
- [ ] 安装了 Capacitor 依赖
- [ ] 初始化了 Capacitor（`npx cap init`）
- [ ] 成功构建了 Next.js（`npm run build`）
- [ ] 添加了 Android 平台（`npx cap add android`）
- [ ] 创建了 `capacitor.config.ts` 并配置了正确的域名
- [ ] 同步了配置（`npx cap sync android`）
- [ ] 打开了 Android Studio（`npx cap open android`）
- [ ] Gradle 同步完成
- [ ] 成功运行了应用

---

祝你打包顺利！🎉
