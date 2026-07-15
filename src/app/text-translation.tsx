import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase, callEdgeFunction } from '../lib/supabase';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { getLanguageByCode, languages } from '../constants/languages';
import { Ionicons } from '@expo/vector-icons';
import { TactileButton } from '../components';

const CHAR_LIMIT = 500;

export default function TextTranslationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  const nativeCode = selectedSourceLanguage ?? profile?.native_language ?? 'en';
  const targetCode = selectedTargetLanguage ?? profile?.primary_target_language ?? 'es';
  const filteredLanguages = languages.filter((language) => {
    const query = languageSearch.trim().toLowerCase();
    return !query || language.name.toLowerCase().includes(query) ||
      language.nativeName.toLowerCase().includes(query) || language.code.toLowerCase().includes(query);
  });

  const selectLanguage = (code: string) => {
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

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTranslating(true);

    try {
      // The authenticated Edge Function translates and saves the complete turn
      // as one server-side operation, including for anonymous demo sessions.
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
      setTranslating(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUserId = user?.id || currentUserData.user?.id;
      if (currentUserId) queryClient.invalidateQueries({ queryKey: ['recentSessions', currentUserId] });
    } catch (e: any) {
      console.error(e);
      setTranslating(false);
      Alert.alert('Translation Error', e.message || 'Failed to connect to the translation engine. Please try again.');
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
        // Delete bookmark
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', user.id)
          .eq('translation_item_id', (translationResult as any).id);
        if (error) throw error;
        setIsBookmarked(false);
      } else {
        // Create bookmark
        const { error } = await supabase
          .from('bookmarks')
          .insert({
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.langPair}>
            <Pressable onPress={() => setLanguagePicker('source')} style={styles.languageButton}>
              <Text style={styles.langText}>{getLanguageByCode(nativeCode)?.name}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </Pressable>
            <Ionicons name="arrow-forward" size={16} color={colors.textMuted} style={{ marginHorizontal: 8 }} />
            <Pressable onPress={() => setLanguagePicker('target')} style={styles.languageButton}>
              <Text style={styles.langText}>{getLanguageByCode(targetCode)?.name}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Input Card */}
          <View style={styles.card}>
            <TextInput
              style={styles.textArea}
              placeholder="Type your phrase here..."
              placeholderTextColor={colors.textSubtle}
              multiline
              maxLength={CHAR_LIMIT}
              value={sourceText}
              onChangeText={setSourceText}
            />
            <View style={styles.cardFooter}>
              <Text style={styles.charCount}>{sourceText.length} / {CHAR_LIMIT}</Text>
              {sourceText.length > 0 && (
                <Pressable style={styles.clearButton} onPress={() => setSourceText('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Action Trigger */}
          <TactileButton
            title="Translate"
            onPress={handleTranslate}
            loading={translating}
            disabled={!sourceText.trim()}
            style={styles.buttonSpacing}
          />

          {/* Results Area */}
          {translationResult && (
            <View style={styles.resultsContainer}>
              <Text style={styles.sectionHeader}>Translation</Text>
              
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultLang}>{getLanguageByCode(targetCode)?.name}</Text>
                  <View style={styles.actionsRow}>
                    <Pressable style={styles.actionIcon} onPress={handleBookmarkToggle}>
                      <Ionicons 
                        name={isBookmarked ? 'bookmark' : 'bookmark-outline'} 
                        size={20} 
                        color={isBookmarked ? colors.accentPurple : colors.textMuted} 
                      />
                    </Pressable>
                    <Pressable style={styles.actionIcon} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                      <Ionicons name="volume-medium" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.resultText}>{translationResult.translated}</Text>
                
                {/* Transliteration Link */}
                <Pressable 
                  style={styles.translitLink} 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowTransliterationSheet(true);
                  }}
                >
                  <Ionicons name="volume-medium-outline" size={16} color={colors.accentPurple} style={{ marginRight: 4 }} />
                  <Text style={styles.translitLinkText}>Show phonetic pronunciation</Text>
                </Pressable>
              </View>

              {/* Context Notes Card */}
              {translationResult.notes && (
                <View style={styles.notesCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Ionicons name="bulb-outline" size={16} color={colors.accentOrange} style={{ marginRight: 6 }} />
                    <Text style={styles.notesTitle}>Context Guidance</Text>
                  </View>
                  <Text style={styles.notesContent}>{translationResult.notes}</Text>
                </View>
              )}

              {/* Alternatives List */}
              {translationResult.alternatives && translationResult.alternatives.length > 0 && (
                <View style={styles.alternativesContainer}>
                  <Text style={styles.sectionHeader}>Alternatives</Text>
                  {translationResult.alternatives.map((alt, idx) => (
                    <View key={idx} style={styles.altCard}>
                      <Text style={styles.altText}>{alt}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Phonetic Pronunciation Bottom Sheet */}
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
                Capitalized letters indicate where the stress / emphasis should be placed.
              </Text>
            </View>
          </View>
        </View>
      )}

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
                  {languagePicker === 'source' ? 'Choose source language' : 'Choose target language'}
                </Text>
                <Text style={styles.languageCount}>{languages.length} supported languages</Text>
              </View>
              <Pressable onPress={() => setLanguagePicker(null)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              value={languageSearch}
              onChangeText={setLanguageSearch}
              placeholder="Search language or code"
              placeholderTextColor={colors.textSubtle}
              style={styles.languageSearch}
              autoCapitalize="none"
            />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {filteredLanguages.map((language) => {
                const selected = (languagePicker === 'source' ? nativeCode : targetCode) === language.code;
                return (
                  <Pressable
                    key={language.code}
                    style={[styles.languageRow, selected && styles.languageRowSelected]}
                    onPress={() => selectLanguage(language.code)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.languageName}>{language.name}</Text>
                      <Text style={styles.languageNative}>{language.nativeName} · {language.code}</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  langPair: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  langText: {
    fontSize: 16,
    fontFamily: typography.bodySemibold.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 160,
    justifyContent: 'space-between',
  },
  textArea: {
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 12,
    fontFamily: typography.tabular.fontFamily,
    color: colors.textSubtle,
  },
  clearButton: {
    padding: 4,
  },
  translateButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  translateButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  translateButtonText: {
    fontSize: 16,
    fontFamily: typography.button.fontFamily,
    fontWeight: typography.button.fontWeight,
    color: colors.textInverse,
  },
  resultsContainer: {
    marginTop: 10,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  resultCard: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultLang: {
    fontSize: 12,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionIcon: {
    padding: 4,
  },
  resultText: {
    fontSize: 18,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: 12,
  },
  translitLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  translitLinkText: {
    fontSize: 13,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.accentPurple,
  },
  notesCard: {
    backgroundColor: colors.surfaceWarning,
    borderWidth: 1,
    borderColor: '#F9E5C9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  notesTitle: {
    fontSize: 13,
    fontFamily: typography.bodySemibold.fontFamily,
    color: colors.warning,
  },
  notesContent: {
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  alternativesContainer: {
    marginBottom: 20,
  },
  altCard: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  altText: {
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
    color: colors.textPrimary,
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
    padding: 24,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: typography.heading4.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sheetBody: {
    gap: 12,
  },
  phoneticLabel: {
    fontSize: 11,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  phoneticText: {
    fontSize: 22,
    fontFamily: typography.heading2.fontFamily,
    fontWeight: '700',
    color: colors.accentPurple,
  },
  phoneticDesc: {
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  buttonSpacing: {
    marginTop: 16,
  },
  languageOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  languageSheet: {
    maxHeight: '78%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  languageCount: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: typography.captionMedium.fontFamily,
  },
  languageSearch: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 4,
  },
  languageRowSelected: {
    backgroundColor: colors.surfaceSoft,
  },
  languageName: {
    fontSize: 15,
    fontFamily: typography.bodySemibold.fontFamily,
    color: colors.textPrimary,
  },
  languageNative: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: typography.captionMedium.fontFamily,
    color: colors.textMuted,
  },
});
