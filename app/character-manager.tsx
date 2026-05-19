import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';
import { buildHttpBaseURL } from '@/utils/devConnectionConfig';
import {
  createCharactersApiClient,
  catgirlToCharacter,
  characterToCatgirl,
  masterToState,
  type Character,
  type CharactersData,
  type MasterProfile,
} from '@/services/api/characters';

export default function CharacterManagerScreen() {
  const router = useRouter();
  const { config, isLoaded } = useDevConnectionConfig();
  const apiBase = buildHttpBaseURL(config);
  const p2pToken = config.p2p?.token;
  const { t } = useTranslation();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [masterProfile, setMasterProfile] = useState<{ name: string; nickname?: string; gender?: string }>({ name: '' });
  const [catgirls, setCatgirls] = useState<Character[]>([]);
  const [currentCatgirl, setCurrentCatgirl] = useState<string | null>(null);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [isNewCharacter, setIsNewCharacter] = useState(false);

  const cc = theme.colors;

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: cc.page },
    keyboardView: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { fontSize: theme.fontSize.callout, color: cc.textPrimary },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: cc.border },
    backButton: { padding: theme.spacing.sm },
    headerTitle: { flex: 1, fontSize: theme.fontSize.headline, fontWeight: theme.fontWeight.bold, color: cc.textPrimary, textAlign: 'center' },
    headerSpacer: { width: 40 },
    messageBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, backgroundColor: cc.error },
    messageRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 },
    messageText: { color: '#fff', flex: 1 },
    content: { flex: 1, paddingHorizontal: theme.spacing.lg },
    section: { marginTop: theme.spacing.xl },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
    sectionIcon: { marginRight: theme.spacing.sm },
    sectionTitle: { flex: 1, fontSize: theme.fontSize.callout, fontWeight: theme.fontWeight.semibold, color: cc.textPrimary },
    addBtn: { width: theme.spacing.xxxl, height: theme.spacing.xxxl, borderRadius: theme.radius.lg, justifyContent: 'center', alignItems: 'center', backgroundColor: cc.accent },
    card: { borderRadius: theme.radius.md, padding: theme.spacing.lg, backgroundColor: cc.elevated },
    field: { marginBottom: theme.spacing.lg },
    label: { fontSize: theme.fontSize.caption, marginBottom: theme.spacing.sm, color: cc.textSecondary },
    input: { borderRadius: theme.radius.sm, padding: theme.spacing.md, fontSize: theme.fontSize.callout, borderWidth: 1, borderColor: cc.border, backgroundColor: cc.page, color: cc.textPrimary },
    textArea: { minHeight: 100 },
    btn: { borderRadius: theme.radius.sm, padding: 14, alignItems: 'center', marginTop: theme.spacing.sm, backgroundColor: cc.accent },
    btnDisabled: { opacity: 0.5 },
    btnText: { fontSize: theme.fontSize.callout, fontWeight: theme.fontWeight.bold, color: cc.textOnAccent },
    charItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, backgroundColor: cc.elevated },
    charItemCurrent: { borderWidth: 2, borderColor: cc.accent },
    charInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    charIcon: { marginRight: theme.spacing.md },
    charDetails: { flex: 1 },
    charNameRow: { flexDirection: 'row', alignItems: 'center' },
    charName: { fontSize: theme.fontSize.callout, fontWeight: theme.fontWeight.medium, color: cc.textPrimary },
    currentBadge: { marginLeft: theme.spacing.sm },
    charMeta: { fontSize: theme.fontSize.caption, marginTop: 2, color: cc.textMuted },
    charActions: { flexDirection: 'row', marginLeft: theme.spacing.sm },
    actionBtnDefault: { borderRadius: theme.radius.sm, padding: theme.spacing.sm, marginLeft: theme.spacing.xs, backgroundColor: cc.border },
    actionBtnDanger: { borderRadius: theme.radius.sm, padding: theme.spacing.sm, marginLeft: theme.spacing.xs, backgroundColor: cc.error },
    actionBtnText: { fontSize: theme.fontSize.footnote, color: cc.textPrimary },
    emptyContainer: { alignItems: 'center', paddingVertical: theme.spacing.xxxl },
    emptyText: { fontSize: theme.fontSize.callout, color: cc.textMuted },
    emptyHint: { fontSize: theme.fontSize.caption, marginTop: theme.spacing.sm, color: cc.textMuted },
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: cc.overlay },
    modalContent: { borderRadius: theme.radius.lg, width: '90%', maxHeight: '80%', backgroundColor: cc.elevated },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: cc.border },
    modalTitle: { fontSize: theme.fontSize.headline, fontWeight: theme.fontWeight.bold, color: cc.textPrimary },
    modalBody: { padding: theme.spacing.lg, maxHeight: 400 },
    modalFooter: { flexDirection: 'row', padding: theme.spacing.lg, borderTopWidth: 1, borderTopColor: cc.border },
    cancelBtn: { flex: 1, borderRadius: theme.radius.sm, padding: 14, alignItems: 'center', marginRight: theme.spacing.sm, backgroundColor: cc.border },
    cancelBtnText: { fontSize: theme.fontSize.callout, color: cc.textPrimary },
    confirmBtn: { flex: 1, borderRadius: theme.radius.sm, padding: 14, alignItems: 'center', marginLeft: theme.spacing.sm, backgroundColor: cc.accent },
    confirmBtnText: { fontSize: theme.fontSize.callout, fontWeight: theme.fontWeight.bold, color: cc.textOnAccent },
  }), [theme]);

  const loadCharacters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const client = createCharactersApiClient(apiBase, p2pToken);
      const data: CharactersData = await client.getCharacters();
      setMasterProfile(masterToState(data.主人 || { 档案名: '' }));
      const catgirlList: Character[] = [];
      if (data.猫娘) {
        for (const [name, profile] of Object.entries(data.猫娘)) {
          catgirlList.push(catgirlToCharacter(name, profile));
        }
      }
      setCatgirls(catgirlList);
      setCurrentCatgirl(data.当前猫娘 || null);
    } catch (err: any) {
      console.error('Failed to load characters:', err);
      setError(err.message || t('characterManager.error'));
    } finally {
      setLoading(false);
    }
  }, [apiBase, p2pToken, t]);

  useEffect(() => {
    if (!isLoaded) return;
    loadCharacters();
  }, [loadCharacters, isLoaded]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCharacters();
    setRefreshing(false);
  }, [loadCharacters]);

  const handleSaveMaster = useCallback(async () => {
    const trimmedName = masterProfile.name.trim();
    if (!trimmedName) { setError(t('characterManager.nameRequired')); return; }
    try {
      setSaving(true); setError(null);
      const client = createCharactersApiClient(apiBase, p2pToken);
      const profile: MasterProfile = { 档案名: trimmedName };
      const trimmedNickname = masterProfile.nickname?.trim();
      if (trimmedNickname) profile.昵称 = trimmedNickname;
      const trimmedGender = masterProfile.gender?.trim();
      if (trimmedGender) profile.性别 = trimmedGender;
      const result = await client.updateMaster(profile);
      if (result.success) { Alert.alert(t('common.success'), t('characterManager.masterProfile') + ' ' + t('common.saved') + '!'); }
      else { setError(result.error || t('common.error')); }
    } catch (err: any) { setError(err.message || t('common.error')); }
    finally { setSaving(false); }
  }, [apiBase, p2pToken, masterProfile, t]);

  const handleAddCatgirl = useCallback(() => {
    setIsNewCharacter(true);
    setEditingCharacter({ id: '', name: '', nickname: '' });
  }, []);

  const handleEditCatgirl = useCallback((character: Character) => {
    setIsNewCharacter(false);
    setEditingCharacter({ ...character });
  }, []);

  const handleSaveCharacter = useCallback(async (character: Character) => {
    const trimmedName = character.name.trim();
    if (!trimmedName) { Alert.alert(t('common.error'), t('characterManager.nameRequired')); return; }
    try {
      setSaving(true); setError(null);
      const client = createCharactersApiClient(apiBase, p2pToken);
      const trimmedCharacter: Character = { ...character, name: trimmedName, nickname: character.nickname?.trim(), personality: character.personality?.trim(), backstory: character.backstory?.trim() };
      const profile = characterToCatgirl(trimmedCharacter);
      let result;
      if (isNewCharacter) result = await client.addCatgirl(profile);
      else result = await client.updateCatgirl(character.id, profile);
      if (result.success) { await loadCharacters(); setEditingCharacter(null); Alert.alert(t('common.success'), t('characterManager.characterSaved')); }
      else { setError(result.error || t('common.error')); }
    } catch (err: any) { setError(err.message || t('common.error')); }
    finally { setSaving(false); }
  }, [apiBase, p2pToken, isNewCharacter, loadCharacters, t]);

  const handleDeleteCatgirl = useCallback((character: Character) => {
    Alert.alert(t('characterManager.confirmDelete'), t('characterManager.confirmDeleteMessage', { name: character.nickname || character.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        try {
          setSaving(true);
          const client = createCharactersApiClient(apiBase, p2pToken);
          const result = await client.deleteCatgirl(character.id);
          if (result.success) { setCatgirls(prev => prev.filter(c => c.id !== character.id)); Alert.alert(t('common.success'), t('characterManager.characterDeleted')); }
          else { setError(result.error || t('common.error')); }
        } catch (err: any) { setError(err.message || t('common.error')); }
        finally { setSaving(false); }
      }},
    ]);
  }, [apiBase, p2pToken, t]);

  const handleSetCurrent = useCallback(async (character: Character) => {
    try {
      setSaving(true);
      const client = createCharactersApiClient(apiBase, p2pToken);
      const result = await client.setCurrentCatgirl(character.name);
      if (result.success) { setCurrentCatgirl(character.name); Alert.alert(t('common.success'), t('characterManager.setCurrentSuccess', { name: character.nickname || character.name })); }
      else { setError(result.error || t('common.error')); }
    } catch (err: any) { setError(err.message || t('common.error')); }
    finally { setSaving(false); }
  }, [apiBase, p2pToken, t]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingContainer}><Text style={s.loadingText}>{t('characterManager.loading')}</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.keyboardView}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Ionicons name="chevron-back" size={24} color={cc.accent} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('characterManager.title')}</Text>
          <View style={s.headerSpacer} />
        </View>

        {error && (
          <View style={s.messageBox}>
            <View style={s.messageRow}><Ionicons name="close-circle" size={16} color="#fff" /><Text style={s.messageText}>{error}</Text></View>
            <TouchableOpacity onPress={() => setError(null)}><Ionicons name="close" size={18} color="#fff" /></TouchableOpacity>
          </View>
        )}

        <ScrollView style={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="person" size={20} color={cc.accent} style={s.sectionIcon} />
              <Text style={s.sectionTitle}>{t('characterManager.masterProfile')}</Text>
            </View>
            <View style={s.card}>
              {[
                { label: t('characterManager.name') + ' *', field: 'name' as const, placeholder: t('characterManager.required') },
                { label: t('characterManager.nickname'), field: 'nickname' as const, placeholder: t('characterManager.optional') },
                { label: t('characterManager.gender'), field: 'gender' as const, placeholder: t('characterManager.optional') },
              ].map(({ label, field, placeholder }) => (
                <View key={field} style={s.field}>
                  <Text style={s.label}>{label}</Text>
                  <TextInput style={s.input} value={masterProfile[field] || ''} onChangeText={(text) => setMasterProfile({ ...masterProfile, [field]: text })} placeholder={placeholder} placeholderTextColor={cc.textMuted} maxLength={20} />
                </View>
              ))}
              <TouchableOpacity style={[s.btn, saving && s.btnDisabled]} onPress={handleSaveMaster} disabled={saving}>
                <Text style={s.btnText}>{saving ? t('characterManager.saving') : t('characterManager.saveMaster')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="paw" size={20} color={cc.accent} style={s.sectionIcon} />
              <Text style={s.sectionTitle}>{t('characterManager.characters')}</Text>
              <TouchableOpacity style={s.addBtn} onPress={handleAddCatgirl}>
                <Ionicons name="add" size={20} color={cc.textOnAccent} />
              </TouchableOpacity>
            </View>
            <FlatList data={catgirls} renderItem={({ item }) => {
              const isCurrent = currentCatgirl === item.name;
              return (
                <View style={[s.charItem, isCurrent && s.charItemCurrent]}>
                  <View style={s.charInfo}>
                    <Ionicons name="paw" size={24} color={cc.accent} style={s.charIcon} />
                    <View style={s.charDetails}>
                      <View style={s.charNameRow}>
                        <Text style={s.charName}>{item.nickname || item.name}</Text>
                        {isCurrent && <Ionicons name="star" size={16} color={cc.warning} style={s.currentBadge} />}
                      </View>
                      {item.personality && <Text style={s.charMeta} numberOfLines={1}>{item.personality}</Text>}
                    </View>
                  </View>
                  <View style={s.charActions}>
                    {!isCurrent && (
                      <TouchableOpacity style={s.actionBtnDefault} onPress={() => handleSetCurrent(item)}>
                        <Text style={s.actionBtnText}>{t('characterManager.setCurrent')}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={s.actionBtnDefault} onPress={() => handleEditCatgirl(item)}>
                      <Ionicons name="create" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtnDanger} onPress={() => handleDeleteCatgirl(item)}>
                      <Ionicons name="trash" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }} keyExtractor={(item) => item.id} scrollEnabled={false} ListEmptyComponent={
              <View style={s.emptyContainer}>
                <Text style={s.emptyText}>{t('characterManager.noCharacters')}</Text>
                <Text style={s.emptyHint}>{t('characterManager.addCharacterHint')}</Text>
              </View>
            } />
          </View>
        </ScrollView>

        {editingCharacter && (
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{isNewCharacter ? t('characterManager.addCharacter') : t('characterManager.editCharacter')}</Text>
                <TouchableOpacity onPress={() => setEditingCharacter(null)}>
                  <Ionicons name="close" size={24} color={cc.accent} />
                </TouchableOpacity>
              </View>
              <ScrollView style={s.modalBody}>
                {[
                  { label: t('characterManager.name') + ' *', field: 'name' as const, placeholder: t('characterManager.name'), editable: isNewCharacter },
                  { label: t('characterManager.nickname'), field: 'nickname' as const, placeholder: t('characterManager.nickname'), editable: true },
                  { label: t('characterManager.personality'), field: 'personality' as const, placeholder: t('characterManager.personality'), editable: true },
                  { label: t('characterManager.backstory'), field: 'backstory' as const, placeholder: t('characterManager.backstory'), editable: true, multiline: true },
                ].map(({ label, field, placeholder, editable, multiline }) => (
                  <View key={field} style={s.field}>
                    <Text style={s.label}>{label}</Text>
                    <TextInput style={[s.input, multiline && s.textArea]} value={editingCharacter[field] || ''} onChangeText={(text) => setEditingCharacter({ ...editingCharacter, [field]: text })} placeholder={placeholder} placeholderTextColor={cc.textMuted} editable={editable} multiline={multiline} numberOfLines={multiline ? 4 : undefined} textAlignVertical={multiline ? 'top' : undefined} />
                  </View>
                ))}
              </ScrollView>
              <View style={s.modalFooter}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setEditingCharacter(null)}>
                  <Text style={s.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.confirmBtn, saving && s.btnDisabled]} onPress={() => handleSaveCharacter(editingCharacter)} disabled={saving}>
                  <Text style={s.confirmBtnText}>{saving ? t('characterManager.saving') : t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
