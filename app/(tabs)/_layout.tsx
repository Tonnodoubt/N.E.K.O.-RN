import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/constants/ThemeContext';

function GlassTabBar({ state, descriptors, navigation }: any) {
  const theme = useTheme();
  const cc = theme.colors;
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={theme.isDark ? 40 : 60}
      tint={theme.isDark ? 'dark' : 'light'}
      style={[
        styles.tabBar,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          borderColor: cc.border,
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const label = options.title ?? route.name;
        const Icon = options.tabBarIcon;

        const onPress = () => {
          if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={[
              styles.tabItem,
              isFocused && { backgroundColor: cc.accentSoft },
            ]}
            activeOpacity={0.7}
          >
            {Icon && <Icon size={22} color={isFocused ? cc.accent : cc.textMuted} />}
            <Text
              style={[
                styles.tabLabel,
                { color: isFocused ? cc.accent : cc.textMuted },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="main"
        options={{
          title: 'Main UI',
          tabBarIcon: ({ color, size }) => <Ionicons name="happy-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
