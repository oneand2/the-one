#!/bin/bash

# 查找和复制 APK 文件到 public 目录的辅助脚本

echo "=========================================="
echo "🔍 正在查找 APK 文件..."
echo "=========================================="
echo ""

# 查找 APK 文件（排除 node_modules）
APK_FILES=$(find . -name "*.apk" -type f 2>/dev/null | grep -v node_modules)

if [ -z "$APK_FILES" ]; then
    echo "❌ 未找到 APK 文件"
    echo ""
    echo "请确认："
    echo "1. 你已经在 Android Studio 中构建了 APK"
    echo "2. APK 文件通常位于: android/app/build/outputs/apk/"
    echo ""
    echo "手动查找 APK 文件位置："
    echo "  cd android/app/build/outputs/apk/"
    echo "  ls -R"
    exit 1
fi

echo "✅ 找到以下 APK 文件："
echo ""

# 显示找到的 APK 文件列表
i=1
declare -a apk_array
while IFS= read -r file; do
    size=$(du -h "$file" | cut -f1)
    echo "[$i] $file (大小: $size)"
    apk_array[$i]=$file
    ((i++))
done <<< "$APK_FILES"

echo ""

# 如果只有一个 APK 文件，直接复制
if [ ${#apk_array[@]} -eq 1 ]; then
    SOURCE_APK="${apk_array[1]}"
    echo "📦 准备复制: $SOURCE_APK"
else
    # 多个 APK 文件，让用户选择
    echo "请选择要使用的 APK 文件 (输入数字):"
    read -r choice
    
    if [ -z "${apk_array[$choice]}" ]; then
        echo "❌ 无效的选择"
        exit 1
    fi
    
    SOURCE_APK="${apk_array[$choice]}"
fi

echo ""
echo "=========================================="
echo "📋 复制信息"
echo "=========================================="
echo "源文件: $SOURCE_APK"
echo "目标位置: public/app-release.apk"
echo ""

# 确认是否复制
read -p "确认复制? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 0
fi

# 复制文件
cp "$SOURCE_APK" public/app-release.apk

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ 复制成功！"
    echo "=========================================="
    echo ""
    
    # 显示文件信息
    if [ -f public/app-release.apk ]; then
        FILE_SIZE=$(du -h public/app-release.apk | cut -f1)
        echo "文件位置: public/app-release.apk"
        echo "文件大小: $FILE_SIZE"
        echo ""
        
        # 检查文件大小是否过大
        SIZE_MB=$(du -m public/app-release.apk | cut -f1)
        if [ "$SIZE_MB" -gt 100 ]; then
            echo "⚠️  警告: APK 文件大小 ($FILE_SIZE) 超过 100MB"
            echo "   Git 可能无法提交此文件"
            echo "   建议使用云存储服务托管 APK 文件"
            echo ""
        fi
        
        echo "📝 下一步操作："
        echo "1. 测试下载功能: npm run dev"
        echo "2. 访问: http://localhost:3000/download"
        echo "3. 点击下载按钮测试"
        echo ""
        echo "如果测试通过，可以提交代码："
        echo "  git add public/app-release.apk src/app/download/page.tsx"
        echo "  git commit -m \"Add Android APK and update download page\""
        echo "  git push"
    fi
else
    echo "❌ 复制失败"
    exit 1
fi
