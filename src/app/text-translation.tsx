import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Clipboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase, callEdgeFunction } from '../lib/supabase';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { getLanguageByCode, languages } from '../constants/languages';
import { Ionicons } from '@expo/vector-icons';
import { generateUUID } from '../utils/uuid';
import {
  useCreateActivity,
  useActivityHistoryList,
  useDeleteActivity,
} from '../hooks/useActivityHistory';
import { historyService } from '../services/historyService';
import { elevenLabsService } from '../services/elevenLabs';
import { useAudioPlayer } from 'expo-audio';
import { useTheme } from '../contexts/ThemeContext';

const CHAR_LIMIT = 500;

export default function TextTranslationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  const [currentRequestId, setCurrentRequestId] = useState(generateUUID());
  const [outputAudioUrl, setOutputAudioUrl] = useState<string | null>(null);
  const player = useAudioPlayer(outputAudioUrl || '');
  const [playingTts, setPlayingTts] = useState(false);

  const [sourceText, setSourceText] = useState('');
  const [translationResult, setTranslationResult] = useState<{
    id?: string;
    translated: string;
    transliteration: string;
    alternatives: string[];
    notes: string;
  } | null>(null);

  const [translating, setTranslating] = useState(false);
  const [showTransliterationSheet, setShowTransliterationSheet] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [selectedSourceLanguage, setSelectedSourceLanguage] = useState<string | null>(null);
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState<string | null>(null);
  const [languagePicker, setLanguagePicker] = useState<'source' | 'target' | null>(null);
  const [languageSearch, setLanguageSearch] = useState('');

  // Fetch profile
  const { data: profile } = useQuery<any>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const createActivityMutation = useCreateActivity();
  const deleteActivityMutation = useDeleteActivity();
  const { data: history = [], isLoading: loadingHistory } = useActivityHistoryList({
    tool: 'type',
    limit: 5,
  });

  const nativeCode = selectedSourceLanguage ?? profile?.native_language ?? 'en';
  const targetCode = selectedTargetLanguage ?? profile?.primary_target_language ?? 'es';

  const filteredLanguages = languages.filter((language) => {
    const query = languageSearch.trim().toLowerCase();
    return (
      !query ||
      language.name.toLowerCase().includes(query) ||
      language.nativeName.toLowerCase().includes(query) ||
      language.code.toLowerCase().includes(query)
    );
  });

  const selectLanguage = (code: string) => {
    Haptics.selectionAsync();
    if (languagePicker === 'source') {
      setSelectedSourceLanguage(code);
      if (code === targetCode) setSelectedTargetLanguage(nativeCode);
    } else {
      setSelectedTargetLanguage(code);
      if (code === nativeCode) setSelectedSourceLanguage(targetCode);
    }
    setLanguagePicker(null);
    setLanguageSearch('');
    setTranslationResult(null);
  };

  const swapLanguages = () => {
    Haptics.selectionAsync();
    const temp = nativeCode;
    setSelectedSourceLanguage(targetCode);
    setSelectedTargetLanguage(temp);
    setTranslationResult(null);
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTranslating(true);

    try {
      const { data: translationResultData, error: transError } = await callEdgeFunction<{
        session_id: string;
        translation_item_id: string;
        translated_text: string;
        detected_language: string;
        transliteration?: string | null;
        alternatives?: string[];
        context_notes?: string;
      }>('translate-text', {
        source: nativeCode,
        target: targetCode,
        text: sourceText,
      });

      if (transError || !translationResultData) {
        throw transError || new Error('Failed to translate text.');
      }

      const translated = translationResultData.translated_text;
      const transliteration = translationResultData.transliteration || '';
      const alternatives = translationResultData.alternatives || [];
      const notes = translationResultData.context_notes || '';

      setTranslationResult({
        id: translationResultData.translation_item_id,
        translated,
        transliteration,
        alternatives,
        notes,
      });
      setIsBookmarked(false);

      // Save to unified activity_history in Supabase
      if (user) {
        await createActivityMutation.mutateAsync({
          client_request_id: currentRequestId,
          tool: 'type',
          operation_type: 'text_translation',
          title: sourceText.slice(0, 80),
          source_language: nativeCode,
          target_language: targetCode,
          source_text: sourceText,
          translated_text: translated,
          metadata: {
            alternatives,
            context_notes: notes,
            transliteration,
            translation_item_id: translationResultData.translation_item_id,
          },
        });
      }

      setCurrentRequestId(generateUUID());
      setTranslating(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUserId = user?.id || currentUserData.user?.id;
      if (currentUserId) queryClient.invalidateQueries({ queryKey: ['recentSessions', currentUserId] });
    } catch (e: any) {
      console.error(e);
      setTranslating(false);
      Alert.alert(
        'Translation Error',
        e.message || 'Failed to connect to the translation engine. Please try again.'
      );
    }
  };

  useEffect(() => {
    if (playingTts && !player.playing && player.currentTime >= player.duration - 0.2) {
      setPlayingTts(false);
    }
  }, [player.playing, player.currentTime]);

  const handleTtsPlayback = async () => {
    if (!translationResult?.translated) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (playingTts) {
      player.pause();
      setPlayingTts(false);
      return;
    }

    try {
      setPlayingTts(true);
      let audioUrl = outputAudioUrl;
      if (!audioUrl) {
        const res = await elevenLabsService.generateSpeech(
          translationResult.translated,
          '21m00Tcm4TlvDq8ikWAM',
          true
        );
        if (res && res.url) {
          audioUrl = res.url;
          setOutputAudioUrl(res.url);
        } else {
          throw new Error('TTS synthesis returned empty URL');
        }
      }
      player.replace({ uri: audioUrl });
      player.play();
    } catch (err: any) {
      console.error(err);
      Alert.alert('TTS Playback Failed', err.message || 'Error occurred during speech synthesis.');
      setPlayingTts(false);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!translationResult) return;
    if (!user) {
      Alert.alert('Sign in Required', 'Bookmarking translations is only available for registered users.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', user.id)
          .eq('translation_item_id', (translationResult as any).id);
        if (error) throw error;
        setIsBookmarked(false);
      } else {
        const { error } = await supabase.from('bookmarks').insert({
          user_id: user.id,
          translation_item_id: (translationResult as any).id,
          source_text: sourceText,
          translated_text: (translationResult as any).translated,
          source_language: nativeCode,
          target_language: targetCode,
          tags: ['text'],
          note: (translationResult as any).notes,
        } as any);
        if (error) throw error;
        setIsBookmarked(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      queryClient.invalidateQueries({ queryKey: ['homeBookmarks', user.id] });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSourceTextChange = (text: string) => {
    setSourceText(text);
    setCurrentRequestId(generateUUID());
    if (!text.trim()) {
      setTranslationResult(null);
    }
  };

  const handleSelectHistoryItem = (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSourceText(item.source_text || '');
    setTranslationResult({
      id: item.metadata?.translation_item_id,
      translated: item.translated_text || '',
      transliteration: item.metadata?.transliteration || '',
      alternatives: item.metadata?.alternatives || [],
      notes: item.metadata?.context_notes || '',
    });
  };

  const handleDeleteHistoryItem = (itemId: string) => {
    Alert.alert(
      'Delete History Item',
      'Are you sure you want to delete this translation from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await deleteActivityMutation.mutateAsync(itemId);
            } catch (err: any) {
              Alert.alert('Deletion Error', err.message || 'Failed to delete history item.');
            }
          },
        },
      ]
    );
  };

  const handleExportHistoryItem = async (item: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await historyService.exportActivity(item);
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export translation.');
    }
  };

  const handlePaste = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const text = await Clipboard.getString();
      if (text) {
        handleSourceTextChange(text);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleCopy = () => {
    if (!translationResult?.translated) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Clipboard.setString(translationResult.translated);
    Alert.alert('Copied', 'Translation copied to clipboard.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.langPair}>
            <Pressable onPress={() => setLanguagePicker('source')} style={styles.languageButton}>
              <Text style={styles.langText}>{getLanguageByCode(nativeCode)?.name}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </Pressable>

            <Pressable onPress={swapLanguages} style={styles.swapButton}>
              <Ionicons name="swap-horizontal" size={18} color={colors.accentPurple} />
            </Pressable>

            <Pressable onPress={() => setLanguagePicker('target')} style={styles.languageButton}>
              <Text style={styles.langText}>{getLanguageByCode(targetCode)?.name}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Text Input Card */}
          <View style={styles.inputCard}>
            <TextInput
              style={styles.textArea}
              placeholder="Type or paste text to translate..."
              placeholderTextColor={colors.textSubtle}
              multiline
              maxLength={CHAR_LIMIT}
              value={sourceText}
              onChangeText={handleSourceTextChange}
            />

            <View style={styles.cardFooter}>
              <Text style={styles.charCount}>
                {sourceText.length} / {CHAR_LIMIT}
              </Text>
              <View style={styles.footerActions}>
                {sourceText.length > 0 ? (
                  <Pressable style={styles.cardActionBtn} onPress={() => handleSourceTextChange('')}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </Pressable>
                ) : (
                  <Pressable style={styles.cardActionBtn} onPress={handlePaste}>
                    <Ionicons name="clipboard-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.cardActionText}>Paste</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          {/* Premium Black Action Button */}
          <Pressable
            onPress={handleTranslate}
            disabled={!sourceText.trim() || translating}
            style={({ pressed }) => [
              styles.translateBtn,
              !sourceText.trim() && styles.translateBtnDisabled,
              pressed && styles.translateBtnPressed,
            ]}
          >
            {translating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.translateBtnText}>Translate</Text>
            )}
          </Pressable>

          {/* Result Card */}
          {translationResult && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultLangLabel}>
                  {getLanguageByCode(targetCode)?.name.toUpperCase()}
                </Text>
                <View style={styles.resultActions}>
                  <Pressable style={styles.actionIcon} onPress={handleBookmarkToggle}>
                    <Ionicons
                      name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                      size={20}
                      color={isBookmarked ? colors.accentPurple : colors.textSecondary}
                    />
                  </Pressable>
                  <Pressable style={styles.actionIcon} onPress={handleTtsPlayback}>
                    <Ionicons
                      name={playingTts ? 'volume-mute-outline' : 'volume-medium-outline'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                  <Pressable style={styles.actionIcon} onPress={handleCopy}>
                    <Ionicons name="copy-outline" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.resultText}>{translationResult.translated}</Text>

              {translationResult.transliteration.length > 0 && (
                <Pressable
                  style={styles.translitLink}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowTransliterationSheet(true);
                  }}
                >
                  <Ionicons name="eye-outline" size={15} color={colors.accentPurple} />
                  <Text style={styles.translitLinkText}>Phonetic pronunciation</Text>
                </Pressable>
              )}

              {translationResult.notes.length > 0 && (
                <View style={styles.guidanceCard}>
                  <View style={styles.guidanceTitleRow}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                    <Text style={styles.guidanceTitle}>Context Notes</Text>
                  </View>
                  <Text style={styles.guidanceBody}>{translationResult.notes}</Text>
                </View>
              )}
            </View>
          )}

          {/* History Lists */}
          <View style={styles.historySection}>
            <Text style={styles.historyHeading}>Recent Translations</Text>
            {loadingHistory ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : history.length > 0 ? (
              history.map((item) => (
                <View key={item.id} style={styles.historyCard}>
                  <Pressable style={styles.historyCardContent} onPress={() => handleSelectHistoryItem(item)}>
                    <View style={styles.historyCardHeader}>
                      <Text style={styles.historyCardLangPair}>
                        {item.source_language?.toUpperCase()} → {item.target_language?.toUpperCase()}
                      </Text>
                      <Text style={styles.historyCardDate}>
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                      </Text>
                    </View>
                    <Text style={styles.historySource} numberOfLines={1}>
                      {item.source_text}
                    </Text>
                    <Text style={styles.historyTranslation} numberOfLines={1}>
                      {item.translated_text}
                    </Text>
                  </Pressable>
                  <View style={styles.historyCardActions}>
                    <Pressable style={styles.historyActionBtn} onPress={() => handleExportHistoryItem(item)}>
                      <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable style={styles.historyActionBtn} onPress={() => handleDeleteHistoryItem(item.id)}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyHistory}>
                <Ionicons name="book-outline" size={32} color={colors.textSubtle} />
                <Text style={styles.emptyHistoryText}>Your translation log is empty.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Transliteration sheet */}
      {showTransliterationSheet && (
        <View style={styles.bottomSheetOverlay}>
          <Pressable style={styles.dismissOverlay} onPress={() => setShowTransliterationSheet(false)} />
          <View style={styles.bottomSheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>How to Pronounce</Text>
              <Pressable onPress={() => setShowTransliterationSheet(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            <View style={styles.sheetBody}>
              <Text style={styles.phoneticLabel}>PHONETIC ALIGNMENT</Text>
              <Text style={styles.phoneticText}>{translationResult?.transliteration}</Text>
              <Text style={styles.phoneticDesc}>
                Capitalized letters indicate where emphasis is placed.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Language search sheets */}
      <Modal
        visible={languagePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setLanguagePicker(null)}
      >
        <View style={styles.languageOverlay}>
          <View style={styles.languageSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {languagePicker === 'source' ? 'Source Language' : 'Target Language'}
                </Text>
              </View>
              <Pressable onPress={() => setLanguagePicker(null)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              value={languageSearch}
              onChangeText={setLanguageSearch}
              placeholder="Search by name or code..."
              placeholderTextColor={colors.textSubtle}
              style={styles.languageSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {filteredLanguages.map((language) => {
                const selected =
                  (languagePicker === 'source' ? nativeCode : targetCode) === language.code;
                return (
                  <Pressable
                    key={language.code}
                    style={[styles.languageRow, selected && styles.languageRowSelected]}
                    onPress={() => selectLanguage(language.code)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.languageName}>{language.name}</Text>
                      <Text style={styles.languageNative}>
                        {language.nativeName} · {language.code.toUpperCase()}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={colors.accentPurple} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 6,
  },
  langPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  langText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  swapButton: {
    padding: 6,
  },
  scrollContent: {
    padding: 16,
  },
  inputCard: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  textArea: {
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  charCount: {
    fontSize: 11,
    color: colors.textSubtle,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  cardActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  translateBtn: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  translateBtnDisabled: {
    opacity: 0.45,
  },
  translateBtnPressed: {
    opacity: 0.85,
  },
  translateBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultCard: {
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultLangLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionIcon: {
    padding: 4,
  },
  resultText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: 12,
  },
  translitLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  translitLinkText: {
    fontSize: 13,
    color: colors.accentPurple,
    fontWeight: '600',
  },
  guidanceCard: {
    backgroundColor: colors.surfaceWarning,
    borderWidth: 1,
    borderColor: 'rgba(226, 160, 92, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  guidanceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  guidanceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
  },
  guidanceBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  historySection: {
    marginTop: 8,
  },
  historyHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  historyCardContent: {
    flex: 1,
    marginRight: 12,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyCardLangPair: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  historyCardDate: {
    fontSize: 10,
    color: colors.textSubtle,
  },
  historySource: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  historyTranslation: {
    fontSize: 14,
    color: colors.accentPurple,
  },
  historyCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  historyActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyHistory: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyHistoryText: {
    fontSize: 13,
    color: colors.textSubtle,
  },
  bottomSheetOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  dismissOverlay: {
    flex: 1,
  },
  bottomSheetCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sheetBody: {
    gap: 12,
  },
  phoneticLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  phoneticText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.accentPurple,
  },
  phoneticDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  languageOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  languageSheet: {
    maxHeight: '75%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  languageSearch: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    marginBottom: 12,
    fontSize: 14,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  languageRowSelected: {
    backgroundColor: colors.overlayLight || 'rgba(9, 9, 9, 0.08)',
  },
  languageName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  languageNative: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
  },
});
