#!/bin/bash

# Android 录音问题快速测试脚本

echo "🔬 Android 录音诊断脚本"
echo "========================"
echo ""

# 检查设备连接
echo "📱 检查设备连接..."
DEVICES=$(adb devices | grep -v "List of devices" | grep "device$" | wc -l)

if [ "$DEVICES" -eq 0 ]; then
    echo "❌ 未检测到 Android 设备"
    echo "   请确保："
    echo "   1. 设备已通过 USB 连接"
    echo "   2. 已启用 USB 调试"
    echo "   3. 已授权此电脑进行调试"
    exit 1
fi

echo "✅ 检测到 $DEVICES 个设备"
echo ""

# 获取设备信息
echo "📊 设备信息:"
adb shell getprop ro.product.model | xargs echo "  型号:"
adb shell getprop ro.build.version.release | xargs echo "  Android 版本:"
adb shell getprop ro.build.version.sdk | xargs echo "  SDK 版本:"
echo ""

# 检查应用是否已安装
echo "📦 检查应用..."
PACKAGE="com.tiyuchong.nekorn"

if adb shell pm list packages | grep -q "$PACKAGE"; then
    echo "✅ 应用已安装: $PACKAGE"

    # 检查权限
    echo ""
    echo "🔐 检查麦克风权限..."

    PERMISSION=$(adb shell dumpsys package $PACKAGE | grep "android.permission.RECORD_AUDIO" | head -1)

    if echo "$PERMISSION" | grep -q "granted=true"; then
        echo "✅ RECORD_AUDIO 权限已授予"
    else
        echo "❌ RECORD_AUDIO 权限未授予"
        echo ""
        echo "请运行以下命令授予权限："
        echo "  adb shell pm grant $PACKAGE android.permission.RECORD_AUDIO"
    fi
else
    echo "⚠️  应用未安装: $PACKAGE"
    echo "   请先运行: npx expo run:android"
fi

echo ""
echo "📋 实时日志监控"
echo "================"
echo "按 Ctrl+C 停止"
echo ""

# 监听 PCMStream 日志
adb logcat -c  # 清空日志
adb logcat | grep --line-buffered "PCMStream"
