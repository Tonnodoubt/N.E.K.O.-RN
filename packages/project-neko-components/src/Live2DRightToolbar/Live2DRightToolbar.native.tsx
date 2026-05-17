import React from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Switch,
  Text,
  TouchableWithoutFeedback,
} from 'react-native';
import { useT } from '../i18n';
import { useTheme } from '@/constants/ThemeContext';
import {
  usePanelToggle,
  useToolbarButtons,
  useSettingsToggleRows,
  useAgentToggleRows,
  useSettingsMenuItems,
} from './hooks';
import type {
  Live2DAgentToggleId,
  Live2DRightToolbarProps,
  Live2DSettingsMenuId,
  Live2DSettingsToggleId,
} from './types';
import { createToolbarStyles } from './styles.native';

export * from './types';

export function Live2DRightToolbar({
  visible = true,
  right = 24,
  bottom,
  top = 24,
  isMobile,
  micEnabled,
  cameraEnabled,
  goodbyeMode,
  openPanel,
  onOpenPanelChange,
  settings,
  onSettingsChange,
  agent,
  onAgentChange,
  onToggleMic,
  onToggleCamera,
  onGoodbye,
  onReturn,
  onSettingsMenuClick,
}: Live2DRightToolbarProps) {
  const tt = useT();
  const theme = useTheme();
  const styles = createToolbarStyles(theme);

  const { togglePanel } = usePanelToggle(openPanel, onOpenPanelChange);

  const buttons = useToolbarButtons<number>({
    micEnabled,
    cameraEnabled,
    openPanel,
    goodbyeMode,
    isMobile,
    onToggleMic,
    onToggleCamera,
    onGoodbye,
    togglePanel,
    t: tt,
    icons: {
      mic: require('../../../../assets/icons/mic_icon_off.png'),
      camera: require('../../../../assets/icons/screen_icon_off.png'),
      agent: require('../../../../assets/icons/Agent_off.png'),
      settings: require('../../../../assets/icons/set_off.png'),
      goodbye: require('../../../../assets/icons/rest_off.png'),
    },
  });

  const settingsToggleRows = useSettingsToggleRows(settings, tt);
  const agentToggleRows = useAgentToggleRows(agent, tt);
  const settingsMenuItems = useSettingsMenuItems<number>(tt, {
    icons: {
      live2dSettings: require('../../../../assets/icons/set_off.png'),
      apiKeys: require('../../../../assets/icons/set_off.png'),
      characterManage: require('../../../../assets/icons/character_icon.png'),
      reload: require('../../../../assets/icons/character_icon.png'),
      voiceClone: require('../../../../assets/icons/set_off.png'),
      memoryBrowser: require('../../../../assets/icons/set_off.png'),
      steamWorkshop: require('../../../../assets/icons/set_off.png'),
      connectionHelp: require('../../../../assets/icons/set_off.png'),
      chatFont: require('../../../../assets/icons/set_off.png'),
    },
  });

  const switchTrackColor = { false: theme.colors.textMuted, true: theme.colors.accent };

  if (!visible) return null;

  return (
    <>
      {/* 浮动按钮组 */}
      <View style={[styles.container, { right, top: top ?? undefined, bottom: bottom ?? undefined }]}>
        {goodbyeMode ? (
          <TouchableOpacity
            style={[styles.button, styles.returnButton]}
            onPress={onReturn}
            activeOpacity={0.7}
          >
            <Image
              source={require('../../../../assets/icons/rest_off.png')}
              style={styles.icon}
            />
          </TouchableOpacity>
        ) : (
          buttons.map((button) => (
            <TouchableOpacity
              key={button.id}
              style={[styles.button, button.active && styles.buttonActive]}
              onPress={button.onClick}
              activeOpacity={0.7}
            >
              <Image source={button.icon} style={styles.icon} />
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Agent Panel Modal */}
      <Modal
        visible={openPanel === 'agent'}
        transparent
        animationType="slide"
        onRequestClose={() => onOpenPanelChange(null)}
      >
        <TouchableWithoutFeedback onPress={() => onOpenPanelChange(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.panelContainer}>
                <Text style={styles.statusText}>{agent.statusText}</Text>

                <ScrollView style={styles.scrollView}>
                  {agentToggleRows.map((row) => (
                    <View
                      key={row.id}
                      style={[styles.row, row.disabled && styles.rowDisabled]}
                    >
                      <Switch
                        value={row.checked}
                        onValueChange={(value) => onAgentChange(row.id as Live2DAgentToggleId, value)}
                        disabled={row.disabled}
                        trackColor={switchTrackColor}
                        thumbColor={theme.colors.textOnAccent}
                      />
                      <Text style={[styles.label, row.disabled && styles.labelDisabled]}>
                        {row.label}
                      </Text>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => onOpenPanelChange(null)}
                >
                  <Text style={styles.closeButtonText}>{tt('close')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Settings Panel Modal */}
      <Modal
        visible={openPanel === 'settings'}
        transparent
        animationType="slide"
        onRequestClose={() => onOpenPanelChange(null)}
      >
        <TouchableWithoutFeedback onPress={() => onOpenPanelChange(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.panelContainer}>
                <Text style={styles.panelTitle}>{tt('settings')}</Text>

                <ScrollView style={styles.scrollView}>
                  {settingsToggleRows.map((row) => (
                    <View key={row.id} style={styles.row}>
                      <Switch
                        value={row.checked}
                        onValueChange={(value) => onSettingsChange(row.id as Live2DSettingsToggleId, value)}
                        trackColor={switchTrackColor}
                        thumbColor={theme.colors.textOnAccent}
                      />
                      <Text style={styles.label}>{row.label}</Text>
                    </View>
                  ))}

                  {!isMobile && (
                    <>
                      <View style={styles.separator} />
                      {settingsMenuItems.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.menuItem}
                          onPress={() => onSettingsMenuClick?.(item.id as Live2DSettingsMenuId)}
                        >
                          <View style={styles.menuItemContent}>
                            <Image source={item.icon} style={styles.menuIcon} />
                            <Text style={styles.menuItemText}>{item.label}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {isMobile && (
                    <>
                      <View style={styles.separator} />
                      {settingsMenuItems
                        .filter((item) => item.id === 'characterManage' || item.id === 'reload')
                        .map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.menuItem}
                            onPress={() => onSettingsMenuClick?.(item.id as Live2DSettingsMenuId)}
                          >
                            <View style={styles.menuItemContent}>
                              <Image source={item.icon} style={styles.menuIcon} />
                              <Text style={styles.menuItemText}>{item.label}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                    </>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => onOpenPanelChange(null)}
                >
                  <Text style={styles.closeButtonText}>{tt('close')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
