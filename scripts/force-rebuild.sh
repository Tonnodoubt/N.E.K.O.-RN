#!/bin/bash

# 强制重新编译并安装 APK
# 包括：清理缓存、重新打包、卸载旧版、安装新版

set -e

echo "🔧 强制重新编译 APK..."
echo "========================"
echo ""

# 步骤 1: 清理 Android 缓存（不删除构建产物）
echo "1️⃣ 清理缓存..."
cd /Users/tongqianqiu/N.E.K.O.-RN
rm -rf node_modules/.cache
rm -rf .expo
rm -rf android/.gradle
rm -rf android/app/build/intermediates
echo "✅ 缓存已清理"
echo ""

# 步骤 2: 重新编译
echo "2️⃣ 重新编译 APK..."
cd android
./gradlew assembleDebug
echo "✅ 编译完成"
echo ""

# 步骤 3: 检查 APK
APK_PATH="/Users/tongqianqiu/N.E.K.O.-RN/android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
    echo "❌ APK 文件不存在"
    exit 1
fi

APK_SIZE=$(ls -lh "$APK_PATH" | awk '{print $5}')
APK_TIME=$(ls -l "$APK_PATH" | awk '{print $6, $7, $8}')
echo "📦 APK 信息:"
echo "  路径: $APK_PATH"
echo "  大小: $APK_SIZE"
echo "  时间: $APK_TIME"
echo ""

# 步骤 4: 卸载旧版本（清除权限状态）
echo "3️⃣ 卸载旧版本（清除权限状态）..."
adb uninstall com.tiyuchong.nekorn 2>/dev/null || true
echo "✅ 旧版本已卸载"
echo ""

# 步骤 5: 安装新版本
echo "4️⃣ 安装新版本..."
adb install "$APK_PATH"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 安装成功！"
    echo ""
    echo "📱 测试步骤："
    echo "  1. 打开 N.E.K.O. 应用"
    echo "  2. 点击语音按钮"
    echo "  3. 应该会弹出权限请求对话框："
    echo "     - 标题: '🎤 需要麦克风权限'"
    echo "     - 按钮: '确定' / '取消' / '稍后询问'"
    echo "  4. 点击'确定'授予权限"
    echo ""
    echo "📋 查看实时日志："
    echo "  adb logcat -c && adb logcat | grep -E '麦克风|PCMStream|权限'"
    echo ""
else
    echo ""
    echo "❌ 安装失败"
    exit 1
fi
