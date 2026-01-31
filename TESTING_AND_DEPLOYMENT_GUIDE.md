# 测试和部署指南

## 本地测试

### 1. 启动开发服务器

```bash
npm run dev
```

### 2. 测试步骤

#### 测试菜单入口
1. 访问 `http://localhost:3000`
2. 确保已登录（如未登录，点击右上角"登录"按钮）
3. 点击右上角的用户头像/昵称
4. 在下拉菜单中应该能看到：
   - 个人设置
   - **客户端下载** ← 新增的菜单项
   - 我的八字排盘
   - 我的八维结果
   - 我的周易解卦
   - 退出

#### 测试下载页面

**在桌面浏览器中测试：**
1. 点击"客户端下载"
2. 应该看到三个卡片：
   - iOS 用户 - 添加到主屏幕教程
   - Android 用户 - 下载 APK 按钮
   - 桌面端 - 说明信息

**在移动端测试（使用开发者工具模拟）：**
1. 打开浏览器开发者工具（F12）
2. 切换到移动设备模式
3. 选择 iPhone 设备
4. 刷新页面，应该只看到 iOS 教程
5. 切换到 Android 设备（如 Pixel）
6. 刷新页面，应该只看到 Android 下载按钮

**测试 APK 下载（需要先添加 APK 文件）：**
1. 在 Android 设备视图中
2. 点击"下载安卓客户端"按钮
3. 浏览器应该开始下载 `the-one.apk` 文件
4. 如果 APK 不存在，会显示 404 错误

## 构建生产版本

### 1. 构建 Next.js 应用

```bash
npm run build
```

### 2. 检查构建输出

确保 `/download` 页面出现在构建输出中：

```
Route (app)
...
├ ○ /download       ← 应该看到这一行
├ ○ /profile
...
```

### 3. 本地测试生产构建

```bash
npm start
```

访问 `http://localhost:3000/download` 验证页面正常工作。

## 部署到生产环境

### Vercel 部署（推荐）

```bash
# 提交代码
git add .
git commit -m "Add download page with iOS and Android guides"
git push

# Vercel 会自动部署
```

### 其他平台部署

确保以下文件包含在部署中：
- `src/app/download/page.tsx` - 下载页面
- `src/components/AuthButton.tsx` - 更新后的菜单
- `public/app-release.apk` - Android APK（如果有）

## 添加 Android APK

### 使用 Capacitor 打包（推荐）

```bash
# 1. 安装 Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. 初始化 Capacitor
npx cap init "The One" "com.theone.app" --web-dir=out

# 3. 构建静态网站
npm run build

# 4. 添加 Android 平台
npx cap add android

# 5. 同步文件
npx cap sync

# 6. 打开 Android Studio
npx cap open android

# 7. 在 Android Studio 中：
# - Build -> Build Bundle(s) / APK(s) -> Build APK(s)
# - 等待构建完成
# - 生成的 APK 位于: android/app/build/outputs/apk/release/app-release.apk

# 8. 复制 APK 到 public 目录
cp android/app/build/outputs/apk/release/app-release.apk public/app-release.apk

# 9. 提交并重新部署
git add public/app-release.apk
git commit -m "Add Android APK"
git push
```

### 配置 Capacitor（如需要）

编辑 `capacitor.config.ts`:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.theone.app',
  appName: 'The One',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  android: {
    buildOptions: {
      keystorePath: '/path/to/your/keystore.jks',
      keystorePassword: 'your-password',
      keystoreAlias: 'your-alias',
      keystoreAliasPassword: 'your-alias-password'
    }
  }
};

export default config;
```

## 常见问题

### Q: APK 下载失败，显示 404
**A:** 确保 `public/app-release.apk` 文件存在，并且已经部署到生产环境。

### Q: iOS 教程步骤是否准确？
**A:** 是的，这是 iOS Safari 标准的"添加到主屏幕"流程。如果 Apple 更新了界面，可能需要更新教程文字。

### Q: 可以只显示其中一种下载方式吗？
**A:** 可以，编辑 `src/app/download/page.tsx`，修改条件渲染逻辑：
- 只显示 iOS：`{(deviceType === 'ios') && ...}`
- 只显示 Android：`{(deviceType === 'android') && ...}`

### Q: 如何自定义页面样式？
**A:** 所有样式都使用 Tailwind CSS，可以直接修改 `page.tsx` 中的 `className` 属性。

### Q: 桌面用户也能下载吗？
**A:** 目前桌面用户可以看到所有选项作为参考，但建议使用浏览器访问。如需桌面客户端，可以考虑使用 Electron 打包。

## 性能优化建议

1. **图片优化**：如果添加截图，使用 Next.js Image 组件
2. **APK 大小**：压缩 APK 或使用 Android App Bundle (AAB)
3. **CDN 加速**：将 APK 文件上传到 CDN，修改下载链接

## 监控和分析

建议添加下载追踪：

```typescript
// 在 handleDownloadAPK 函数中添加
const handleDownloadAPK = () => {
  // 发送下载事件到分析平台
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'download', {
      event_category: 'android_apk',
      event_label: 'download_page'
    });
  }
  
  // 原有的下载逻辑
  const link = document.createElement('a');
  link.href = '/app-release.apk';
  link.download = 'the-one.apk';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

## 未来增强建议

1. **二维码分享**：生成下载页面的二维码，方便用户分享
2. **版本号显示**：显示当前 APK 的版本号和更新日志
3. **自动更新检测**：检测用户是否使用最新版本
4. **下载统计**：显示下载次数
5. **用户反馈**：添加反馈表单收集用户意见
