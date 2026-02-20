#!/bin/bash

# 清除权限状态并重新安装 APK

APK_PATH="/Users/tongqianqiu/N.E.K.O.-RN/android/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE="com.tiyuchong.nekorn"

echo "🗑️  卸载旧版本（清除权限状态）..."
adb uninstall "$PACKAGE" 2>/dev/null || true

echo ""
echo "📦 安装新版本..."
adb install "$APK_PATH"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 安装成功！"
    echo ""
    echo "📱 测试步骤："
    echo "  1. 打开 N.E.K.O. 应用"
    echo "  2. 点击语音按钮"
    echo "  3. 应该会弹出权限请求对话框"
    echo "  4. 点击"确定"授予权限"
    echo ""
    echo "📋 查看实时日志："
    echo "  adb logcat -c && adb logcat | grep -E '麦克风|PCMStream|权限'"
else
    echo ""
    echo "❌ 安装失败"
    exit 1
fi
