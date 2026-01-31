#!/bin/bash

# Capacitor Android 配置脚本（在线加载模式）
# 请按照注释提示，逐步执行每个命令

echo "=========================================="
echo "第 1 步：安装 Capacitor 依赖"
echo "=========================================="
npm install @capacitor/core @capacitor/cli @capacitor/android

echo ""
echo "=========================================="
echo "第 2 步：初始化 Capacitor"
echo "=========================================="
echo "应用名称: The One"
echo "包名: com.theone.app"
npx cap init "The One" "com.theone.app" --web-dir=out

echo ""
echo "=========================================="
echo "⚠️  重要：修改 Next.js 配置"
echo "=========================================="
echo "请手动编辑 next.config.ts，添加以下内容："
echo ""
echo "const nextConfig = {"
echo "  output: 'export',  // 添加这一行"
echo "  images: {"
echo "    unoptimized: true,  // 添加这一行"
echo "  },"
echo "  // ... 保留其他现有配置"
echo "};"
echo ""
read -p "修改完成后按 Enter 继续..."

echo ""
echo "=========================================="
echo "第 3 步：构建 Next.js 静态网站"
echo "=========================================="
npm run build

echo ""
echo "=========================================="
echo "第 4 步：添加 Android 平台"
echo "=========================================="
npx cap add android

echo ""
echo "=========================================="
echo "⚠️  重要：配置在线加载模式"
echo "=========================================="
echo "请编辑项目根目录的 capacitor.config.ts 文件"
echo "添加以下配置（完整示例见 CAPACITOR_ANDROID_SETUP.md）："
echo ""
echo "const config: CapacitorConfig = {"
echo "  appId: 'com.theone.app',"
echo "  appName: 'The One',"
echo "  webDir: 'out',"
echo "  server: {"
echo "    url: 'https://your-domain.com',  // 替换为你的域名"
echo "    androidScheme: 'https'"
echo "  }"
echo "};"
echo ""
read -p "配置完成后按 Enter 继续..."

echo ""
echo "=========================================="
echo "第 5 步：同步配置到 Android 项目"
echo "=========================================="
npx cap sync android

echo ""
echo "=========================================="
echo "第 6 步：打开 Android Studio"
echo "=========================================="
echo "即将打开 Android Studio..."
echo "打开后请等待 Gradle 同步完成"
echo ""
read -p "按 Enter 打开 Android Studio..."
npx cap open android

echo ""
echo "=========================================="
echo "✅ 配置完成！"
echo "=========================================="
echo ""
echo "下一步操作（在 Android Studio 中）："
echo "1. 等待 Gradle 同步完成"
echo "2. 连接 Android 设备或启动模拟器"
echo "3. 点击绿色播放按钮运行应用"
echo "4. 构建 APK：Build → Build Bundle(s) / APK(s) → Build APK(s)"
echo ""
echo "详细说明请查看: CAPACITOR_ANDROID_SETUP.md"
