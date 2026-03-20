/**
 * Live2DRightToolbar React Native 样式
 * 参照主项目 Live2DRightToolbar.css 与 theme.css 实现亮/暗色主题支持
 */

import { StyleSheet, Platform } from 'react-native';

export function createToolbarStyles(isDark: boolean) {
  // 按钮（参照主项目：亮色 rgba(255,255,255,0.65)，暗色 rgba(35,35,35,0.75)）
  const btnBg       = isDark ? 'rgba(35, 35, 35, 0.85)' : 'rgba(255, 255, 255, 0.9)';
  const btnBorder   = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)';

  // 面板（参照主项目：亮色半透明白，暗色 rgba(30,30,30,0.82)）
  const panelBg     = isDark ? 'rgba(25, 25, 35, 0.97)' : 'rgba(255, 255, 255, 0.98)';
  const panelBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(179, 229, 252, 0.8)';

  // 文字
  const titleColor    = isDark ? '#f0f0f0' : '#1a1a2e';
  const labelColor    = isDark ? '#e0e0e0' : '#333';
  const labelDisColor = isDark ? '#666'    : '#999';
  const menuTextColor = isDark ? '#e0e0e0' : '#333';

  // 行/菜单项背景
  const rowBg      = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
  const menuItemBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';

  // 分隔线 & 遮罩
  const separatorColor = isDark ? 'rgba(255, 255, 255, 0.1)'  : 'rgba(0, 0, 0, 0.08)';
  const overlayColor   = isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)';

  // Agent 状态背景
  const statusBg = isDark ? 'rgba(68, 183, 254, 0.1)' : 'rgba(68, 183, 254, 0.08)';

  return StyleSheet.create({
    // 浮动按钮容器
    container: {
      position: 'absolute',
      zIndex: 99999,
      flexDirection: 'column',
    },

    // 按钮
    button: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: btnBg,
      borderWidth: 1,
      borderColor: btnBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.2 : 0.08,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },

    buttonActive: {
      backgroundColor: 'rgba(68, 183, 254, 0.9)',
      borderColor: 'rgba(68, 183, 254, 0.5)',
    },

    returnButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },

    icon: {
      width: '76%',
      height: '76%',
      resizeMode: 'contain',
    },

    // Modal 覆盖层
    modalOverlay: {
      flex: 1,
      backgroundColor: overlayColor,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // 面板容器
    panelContainer: {
      backgroundColor: panelBg,
      borderRadius: 12,
      padding: 20,
      width: '85%',
      maxHeight: '70%',
      borderWidth: 1,
      borderColor: panelBorder,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.4 : 0.15,
          shadowRadius: 16,
        },
        android: {
          elevation: 8,
        },
      }),
    },

    panelTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: titleColor,
      marginBottom: 16,
      textAlign: 'center',
    },

    // Agent 状态文本
    statusText: {
      fontSize: 13,
      color: '#44b7fe',
      padding: 12,
      borderRadius: 6,
      backgroundColor: statusBg,
      marginBottom: 16,
      textAlign: 'center',
    },

    // 滚动视图
    scrollView: {
      maxHeight: 400,
    },

    // Toggle 行
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: rowBg,
      marginBottom: 8,
    },

    rowDisabled: {
      opacity: 0.5,
    },

    // Label
    label: {
      fontSize: 15,
      color: labelColor,
      marginLeft: 12,
      flex: 1,
    },

    labelDisabled: {
      color: labelDisColor,
    },

    // 分隔线
    separator: {
      height: 1,
      backgroundColor: separatorColor,
      marginVertical: 12,
    },

    // 菜单项
    menuItem: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: menuItemBg,
      marginBottom: 8,
    },

    menuItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    menuIcon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
    },

    menuItemText: {
      fontSize: 15,
      color: menuTextColor,
      marginLeft: 10,
      flex: 1,
    },

    // 关闭按钮
    closeButton: {
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: '#44b7fe',
      borderRadius: 8,
      alignItems: 'center',
    },

    closeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });
}
