#!/bin/bash

# 安装最新编译的 APK 到设备

APK_PATH="/Users/tongqianqiu/N.E.K.O.-RN/android/app/build/outputs/apk/debug/app-debug.apk"

echo "📦 安装最新 APK 到设备..."
echo "APK 路径: $APK_PATH"
echo ""

# 检查 APK 文件是否存在
if [ ! -f "$APK_PATH" ]; then
    echo "❌ APK 文件不存在: $APK_PATH"
    echo "请先运行: cd android && ./gradlew assembleDebug"
    exit 1
fi

# 检查设备连接
DEVICES=$(adb devices | grep -v "List of devices" | grep "device$" | wc -l)
if [ "$DEVICES" -eq 0 ]; then
    echo "❌ 未检测到 Android 设备"
    echo "请确保："
    echo "  1. 设备已通过 USB 连接"
    echo "  2. 已启用 USB 调试"
    echo "  3. 已授权此电脑进行调试"
    exit 1
fi

echo "✅ 检测到 $DEVICES 个设备"
echo ""

# 卸载旧版本
echo "🗑️  卸载旧版本..."
adb uninstall com.tiyuchong.nekorn 2>/dev/null || true

# 安装新版本
echo ""
echo "📲 安装新版本..."
adb install "$APK_PATH"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 安装成功！"
    echo ""
    echo "📱 现在可以："
    echo "  1. 打开 N.E.K.O. 应用"
    echo "  2. 导航到 /audio-debug 页面运行诊断"
    echo "  3. 测试语音对话功能"
    echo ""
    echo "📋 查看实时日志："
    echo "  adb logcat -c && adb logcat | grep PCMStream"
else
    echo ""
    echo "❌ 安装失败"
    exit 1
fi
