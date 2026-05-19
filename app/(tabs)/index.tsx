import { View, TouchableOpacity, Text, Modal, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';
import { hasUserStoredConfig } from '@/services/DevConnectionStorage';
import { sessionStore } from '@/utils/sessionStore';
import { useTheme, useThemePreset } from '@/constants/ThemeContext';
import { changeLanguage, SUPPORTED_LANGUAGES } from '@/i18n';
import { presetList } from '@/constants/tokens/presets';

export default function HomeScreen() {
  const router = useRouter();
  const { config, isLoaded, reload } = useDevConnectionConfig();
  const theme = useTheme();
  const cc = theme.colors;
  const { presetId, setPreset } = useThemePreset();
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.resolvedLanguage ?? i18n.language);
  const [menuOpen, setMenuOpen] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const ctaSlide = useRef(new Animated.Value(20)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const handler = (lang: string) => setCurrentLang(lang);
    i18n.on('languageChanged', handler);
    return () => i18n.off('languageChanged', handler);
  }, [i18n]);

  const isFocused = useIsFocused();
  const [isConnected, setIsConnected] = useState(sessionStore.isConnected);
  const [isUserConfigured, setIsUserConfigured] = useState(false);

  useEffect(() => sessionStore.subscribe(setIsConnected), []);
  useEffect(() => {
    if (!isLoaded || !isFocused) return;
    hasUserStoredConfig().then(setIsUserConfigured);
    reload();
  }, [isLoaded, isFocused, reload]);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(ctaSlide, { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  // Pulse animation (connected only)
  useEffect(() => {
    if (!isConnected) return;
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(pulseScale, { toValue: 1.5, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isConnected]);

  const showIp = isUserConfigured && isConnected;
  const characterName = config.characterName || '';
  const gradColors = [cc.accentGradientStart, cc.accentGradientEnd] as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cc.page }}>
      {/* Atmospheric background */}
      <LinearGradient
        colors={[cc.page, cc.elevated, cc.page]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Glow orbs */}
      <View style={{ position: 'absolute', top: '5%', alignSelf: 'center', width: 350, height: 350, borderRadius: 200, backgroundColor: cc.accent + '08' }} />
      <View style={{ position: 'absolute', top: '14%', alignSelf: 'center', width: 210, height: 210, borderRadius: 120, backgroundColor: cc.accentSecondary + '06' }} />

      {/* Top bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, zIndex: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: isConnected ? cc.success + '15' : cc.error + '12' }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isConnected ? cc.success : cc.error }} />
          <Text style={{ fontSize: 12, fontWeight: '500', color: isConnected ? cc.success : cc.error }}>
            {isConnected ? t('home.status.online') : t('home.status.offline')}
          </Text>
          {showIp && <Text style={{ fontSize: 12, fontFamily: 'monospace', color: isConnected ? cc.success : cc.error }}> {config.host}:{config.port}</Text>}
        </View>
        <TouchableOpacity onPress={() => setMenuOpen(true)} activeOpacity={0.7} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: cc.elevated + '60', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: cc.border }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={cc.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, zIndex: 2 }}>

        {/* Avatar orb */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{
              width: 140, height: 140, borderRadius: 70,
              backgroundColor: cc.accentSoft, alignItems: 'center', justifyContent: 'center',
              shadowColor: cc.accent, shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3, shadowRadius: 30, elevation: 8,
            }}>
              <LinearGradient
                colors={isConnected ? gradColors : [cc.border, cc.border]}
                style={{ width: 120, height: 120, borderRadius: 60, padding: 3, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: '100%', height: '100%', borderRadius: 60, backgroundColor: cc.elevated, alignItems: 'center', justifyContent: 'center' }}>
                  {isConnected
                    ? <Ionicons name="paw" size={44} color={cc.accent} />
                    : <Ionicons name="moon" size={40} color={cc.textMuted} />
                  }
                </View>
              </LinearGradient>
            </View>

            {/* Pulse ring */}
            {isConnected && (
              <Animated.View style={{
                position: 'absolute', width: 140, height: 140, borderRadius: 70,
                borderWidth: 1.5, borderColor: cc.accent,
                transform: [{ scale: pulseScale }], opacity: pulseOpacity,
              }} />
            )}
          </View>
        </Animated.View>

        {/* Name */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={{
            fontSize: characterName ? 34 : 28, fontWeight: '700', color: cc.textPrimary,
            letterSpacing: characterName ? 0.5 : 3, marginTop: 28, textAlign: 'center',
          }}>
            {characterName || 'N.E.K.O.'}
          </Text>
        </Animated.View>

        {/* Brand */}
        {characterName && (
          <Text style={{
            fontSize: 18, fontWeight: '800', color: cc.accent,
            letterSpacing: 6, marginTop: 10, textTransform: 'uppercase',
            opacity: 0.7,
          }}>
            N.E.K.O.
          </Text>
        )}

        {/* Status */}
        {isConnected ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: cc.success }} />
            <Text style={{ fontSize: 13, color: cc.textSecondary }}>{t('home.status.online')}</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 13, color: cc.textSecondary, marginTop: 16, textAlign: 'center', lineHeight: 20 }}>
            {t('home.status.unconfigured')}
          </Text>
        )}

        {/* CTA */}
        <Animated.View style={{ marginTop: 36, width: '100%', maxWidth: 300, opacity: fadeAnim, transform: [{ translateY: ctaSlide }] }}>
          <TouchableOpacity
            onPress={() => isConnected
              ? router.push('/main')
              : router.push({ pathname: '/qr-scanner', params: { returnTo: '/main' } })
            }
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={gradColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 18, borderRadius: 28,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: cc.accent, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name={isConnected ? 'chatbubbles' : 'qr-code'} size={20} color={cc.textOnAccent} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: cc.textOnAccent, letterSpacing: 0.5 }}>
                  {isConnected ? t('home.actions.startChat') : t('home.actions.scanToConnect')}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Bottom shortcuts */}
      <View style={{ paddingBottom: 16, zIndex: 2 }}>
        <BlurView
          intensity={theme.isDark ? 25 : 40}
          tint={theme.isDark ? 'dark' : 'light'}
          style={{
            flexDirection: 'row', justifyContent: 'center', gap: 20,
            marginHorizontal: 32, paddingVertical: 14, borderRadius: 28,
            borderWidth: 1, borderColor: cc.border,
          }}
        >
          {[
            { icon: 'paw-outline' as const, label: t('home.characterManager'), onPress: () => router.push('/character-manager') },
            { icon: 'settings-outline' as const, label: t('home.apiSettings'), onPress: () => router.push('/settings') },
            { icon: 'server-outline' as const, label: t('home.serverConnection'), onPress: () => router.push('/server-config') },
          ].map((item) => (
            <TouchableOpacity key={item.icon} onPress={item.onPress} activeOpacity={0.7} style={{ alignItems: 'center', gap: 5, paddingHorizontal: 12 }}>
              <Ionicons name={item.icon} size={22} color={cc.textSecondary} />
              <Text style={{ fontSize: 10, color: cc.textMuted }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </BlurView>
      </View>

      {/* Menu modal */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: cc.overlay }} onPress={() => setMenuOpen(false)}>
          <Pressable style={{
            position: 'absolute', top: 60, right: 16, width: 260,
            borderRadius: 20, backgroundColor: cc.elevated,
            borderWidth: 1, borderColor: cc.border, padding: 20,
            shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
          }} onPress={(e) => e.stopPropagation()}>
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: cc.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Theme</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {presetList.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                      borderColor: presetId === p.id ? cc.accent : cc.border,
                      backgroundColor: presetId === p.id ? cc.accentSoft : cc.page,
                    }}
                    onPress={() => setPreset(p.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: p.accentPreview }} />
                    <Text style={{ fontSize: 12, color: presetId === p.id ? cc.accent : cc.textSecondary }}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: cc.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>{t('settings.sections.language')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <TouchableOpacity
                    key={lang.code}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
                      backgroundColor: currentLang === lang.code ? cc.accent : cc.page,
                      borderWidth: 1, borderColor: currentLang === lang.code ? cc.accent : cc.border,
                    }}
                    onPress={() => changeLanguage(lang.code)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 12, color: currentLang === lang.code ? cc.textOnAccent : cc.textSecondary, fontWeight: currentLang === lang.code ? '700' : '400' }}>
                      {lang.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: cc.separator, marginVertical: 8 }} />
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderRadius: 16 }} onPress={() => { setMenuOpen(false); router.push('/server-config'); }}>
              <Ionicons name="server-outline" size={18} color={cc.accent} />
              <Text style={{ fontSize: 15, color: cc.textPrimary, flex: 1 }}>{t('home.actions.manualConfig')}</Text>
              <Ionicons name="chevron-forward" size={16} color={cc.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderRadius: 16 }} onPress={() => { setMenuOpen(false); router.push({ pathname: '/qr-scanner', params: { returnTo: '/main' } }); }}>
              <Ionicons name="qr-code-outline" size={18} color={cc.accent} />
              <Text style={{ fontSize: 15, color: cc.textPrimary, flex: 1 }}>{t('home.actions.qrConfig')}</Text>
              <Ionicons name="chevron-forward" size={16} color={cc.textMuted} />
            </TouchableOpacity>
            {__DEV__ && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderRadius: 16 }}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/vrm-poc');
                }}
              >
                <Ionicons name="cube-outline" size={18} color={cc.accent} />
                <Text style={{ fontSize: 15, color: cc.textPrimary, flex: 1 }}>VRM PoC</Text>
                <Ionicons name="chevron-forward" size={16} color={cc.textMuted} />
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
