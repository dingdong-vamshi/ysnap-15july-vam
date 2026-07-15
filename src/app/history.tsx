import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, SafeAreaView, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../constants/colors';
import { useTheme, useThemeStyles } from '../contexts/ThemeContext';
import { typography } from '../constants/typography';
import { getLanguageByCode } from '../constants/languages';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { historyService } from '../services/historyService';

type SessionTypeFilter = 'all' | 'type' | 'voice' | 'camera' | 'conversation' | 'accent_changer' | 'voice_clone';

function AudioPlayButton({ audioUrl }: { audioUrl: string }) {
  const styles = useThemeStyles(createStyles);
  const [isPlaying, setIsPlaying] = useState(false);
  const player = useAudioPlayer(audioUrl);

  useEffect(() => {
    if (isPlaying && !player.playing && player.currentTime >= player.duration - 0.2) {
      setIsPlaying(false);
    }
  }, [player.playing, player.currentTime]);

  const togglePlay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.replace({ uri: audioUrl });
      player.play();
      setIsPlaying(true);
    }
  };

  return (
    <Pressable onPress={togglePlay} style={styles.audioPlayBtn}>
      <Ionicons name={isPlaying ? 'pause' : 'play'} size={12} color={colors.primary} />
    </Pressable>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const styles = useThemeStyles(createStyles);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SessionTypeFilter>('all');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<string | null>(null);

  // Detail Modal state
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [signedInputUrl, setSignedInputUrl] = useState<string | null>(null);
  const [signedOutputUrl, setSignedOutputUrl] = useState<string | null>(null);

  // 1. Fetch unified activity_history
  const { data: sessions = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['activityHistory', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('activity_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  // Resolve signed URLs for selected history item
  useEffect(() => {
    if (selectedSession) {
      setSignedInputUrl(null);
      setSignedOutputUrl(null);

      if (selectedSession.input_asset_path) {
        historyService.getSignedUrl(selectedSession.input_asset_path).then(setSignedInputUrl);
      }
      if (selectedSession.output_asset_path) {
        historyService.getSignedUrl(selectedSession.output_asset_path).then(setSignedOutputUrl);
      }
    }
  }, [selectedSession]);

  // Auto-open session if passed in params
  useEffect(() => {
    if (params.sessionId && sessions && sessions.length > 0) {
      const sess = sessions.find((s) => s.id === params.sessionId);
      if (sess) setSelectedSession(sess);
    }
  }, [params.sessionId, sessions]);

  // Filtering Logic
  const filteredSessions = (sessions ?? []).filter((sess) => {
    const matchesSearch = sess.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      sess.source_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sess.translated_text?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = activeFilter === 'all' || sess.tool === activeFilter;
    
    const matchesLang = !selectedLanguageFilter || 
      sess.metadata?.sourceLanguage === selectedLanguageFilter || 
      sess.metadata?.targetLanguage === selectedLanguageFilter;

    return matchesSearch && matchesType && matchesLang;
  });

  const handleSelectSession = (session: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSession(session);
  };

  const handleDismissDetail = () => {
    setSelectedSession(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>History Logs</Text>
        <Pressable 
          style={styles.filterTrigger} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowFilterSheet(true);
          }}
        >
          <Ionicons 
            name="funnel-outline" 
            size={20} 
            color={selectedLanguageFilter ? colors.accentPurple : colors.textPrimary} 
          />
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textSubtle} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by keywords..."
          placeholderTextColor={colors.textSubtle}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filter Chips row */}
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.chipsContainer}
        >
          {(['all', 'type', 'voice', 'camera', 'conversation', 'accent_changer', 'voice_clone'] as SessionTypeFilter[]).map((type) => {
            const selected = activeFilter === type;
            return (
              <Pressable
                key={type}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveFilter(type);
                }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {type === 'type' ? 'Text' : type === 'accent_changer' ? 'Accent' : type === 'voice_clone' ? 'Clone' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main List */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredSessions.length > 0 ? (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {filteredSessions.map((session) => {
            const toolIcon = session.tool === 'voice' 
              ? 'mic-outline' 
              : session.tool === 'camera' 
              ? 'camera-outline' 
              : session.tool === 'conversation'
              ? 'chatbubbles-outline'
              : session.tool === 'accent_changer'
              ? 'sparkles-outline'
              : session.tool === 'voice_clone'
              ? 'people-outline'
              : 'document-text-outline';

            const toolLabel = session.tool === 'type' 
              ? 'TEXT' 
              : session.tool === 'accent_changer' 
              ? 'ACCENT' 
              : session.tool === 'voice_clone' 
              ? 'CLONE' 
              : session.tool?.toUpperCase();

            return (
              <Pressable 
                key={session.id} 
                style={styles.historyCard}
                onPress={() => handleSelectSession(session)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.badgeRow}>
                    <View style={styles.typeBadge}>
                      <Ionicons 
                        name={toolIcon} 
                        size={12} 
                        color={colors.textMuted} 
                        style={{ marginRight: 4 }} 
                      />
                      <Text style={styles.badgeText}>{toolLabel}</Text>
                    </View>
                    {session.metadata?.sourceLanguage && session.metadata?.targetLanguage && (
                      <Text style={styles.langPairLabel}>
                        {getLanguageByCode(session.metadata.sourceLanguage)?.name} → {getLanguageByCode(session.metadata.targetLanguage)?.name}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.cardTime}>
                    {new Date(session.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {session.title || 'Untitled Activity'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="journal-outline" size={48} color={colors.borderStrong} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No matching logs found</Text>
          <Text style={styles.emptyDesc}>Try adjusting filters or search terms.</Text>
        </View>
      )}

      {/* Detail Viewer Modal */}
      <Modal
        visible={selectedSession !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleDismissDetail}
      >
        <View style={styles.detailContainer}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailHeaderTitle}>Activity Details</Text>
            <Pressable style={styles.closeButton} onPress={handleDismissDetail}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
            {/* Meta information card */}
            <View style={styles.metaRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.badgeText}>
                  {selectedSession?.tool === 'type' ? 'TEXT' : selectedSession?.tool?.toUpperCase()}
                </Text>
              </View>
              {selectedSession?.metadata?.sourceLanguage && selectedSession?.metadata?.targetLanguage && (
                <Text style={styles.metaLangs}>
                  {getLanguageByCode(selectedSession.metadata.sourceLanguage)?.name} → {getLanguageByCode(selectedSession.metadata.targetLanguage)?.name}
                </Text>
              )}
            </View>

            <Text style={styles.detailTitle}>{selectedSession?.title || 'Untitled Session'}</Text>
            <View style={styles.detailDivider} />

            {/* Standard Text/Voice translation card */}
            {(selectedSession?.tool === 'type' || selectedSession?.tool === 'voice' || selectedSession?.tool === 'accent_changer') && (
              <View style={styles.translationDetailCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.textLabel}>SOURCE INPUT</Text>
                  {signedInputUrl && (
                    <AudioPlayButton audioUrl={signedInputUrl} />
                  )}
                </View>
                <Text style={styles.sourceVal}>{selectedSession.source_text || 'Voice input clip'}</Text>
                
                {selectedSession.translated_text && (
                  <>
                    <View style={styles.inlineDivider} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={styles.textLabel}>TRANSLATED OUTPUT</Text>
                      {signedOutputUrl && (
                        <AudioPlayButton audioUrl={signedOutputUrl} />
                      )}
                    </View>
                    <Text style={styles.targetVal}>{selectedSession.translated_text}</Text>
                  </>
                )}
              </View>
            )}

            {/* Camera detail layout */}
            {selectedSession?.tool === 'camera' && (
              <View style={{ marginTop: 4 }}>
                {signedInputUrl && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={styles.detailSectionHeading}>Scanned Image</Text>
                    <Image 
                      source={{ uri: signedInputUrl }} 
                      style={styles.scannedImage} 
                      resizeMode="cover" 
                    />
                  </View>
                )}

                {selectedSession.operation_type === 'food' && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={styles.detailSectionHeading}>Nutrition Analysis</Text>
                    <View style={styles.foodReportCard}>
                      <View style={styles.foodReportHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.foodReportTitle}>{selectedSession.translated_text || selectedSession.source_text}</Text>
                          <Text style={styles.foodReportSubTitle}>Original: {selectedSession.source_text}</Text>
                        </View>
                        {selectedSession.metadata?.confidence && (
                          <View style={styles.matchBadge}>
                            <Text style={styles.matchBadgeText}>{selectedSession.metadata.confidence}% Match</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.macroRow}>
                        <View style={styles.macroItem}>
                          <Text style={styles.macroValue}>{selectedSession.metadata?.calories || 0}</Text>
                          <Text style={styles.macroLabel}>CALORIES</Text>
                        </View>
                        <View style={styles.macroItem}>
                          <Text style={[styles.macroValue, { color: colors.accentBlue }]}>{selectedSession.metadata?.protein || '0g'}</Text>
                          <Text style={styles.macroLabel}>PROTEIN</Text>
                        </View>
                        <View style={styles.macroItem}>
                          <Text style={[styles.macroValue, { color: colors.accentOrange }]}>{selectedSession.metadata?.carbs || '0g'}</Text>
                          <Text style={styles.macroLabel}>CARBS</Text>
                        </View>
                        <View style={styles.macroItem}>
                          <Text style={[styles.macroValue, { color: colors.accentCoral }]}>{selectedSession.metadata?.fat || '0g'}</Text>
                          <Text style={styles.macroLabel}>FAT</Text>
                        </View>
                      </View>

                      {selectedSession.metadata?.allergens && selectedSession.metadata.allergens.length > 0 && (
                        <View style={styles.allergenAlertCard}>
                          <Ionicons name="warning-outline" size={16} color={colors.warning} />
                          <Text style={styles.allergenAlertText}>
                            Allergens: {selectedSession.metadata.allergens.join(', ')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {selectedSession.operation_type !== 'food' && (
                  <View style={styles.translationDetailCard}>
                    <Text style={styles.textLabel}>SOURCE TEXT</Text>
                    <Text style={styles.sourceVal}>{selectedSession.source_text}</Text>
                    <View style={styles.inlineDivider} />
                    <Text style={styles.textLabel}>TRANSLATION</Text>
                    <Text style={styles.targetVal}>{selectedSession.translated_text}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Conversation detail layout */}
            {selectedSession?.tool === 'conversation' && (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.detailSectionHeading}>Bilingual Transcript</Text>
                {Array.isArray(selectedSession.transcript) && selectedSession.transcript.length > 0 ? (
                  selectedSession.transcript.map((t: any, idx: number) => (
                    <View key={idx} style={styles.translationDetailCard}>
                      <Text style={styles.textLabel}>SPEAKER {t.speaker || 'UNKNOWN'}</Text>
                      <Text style={styles.sourceVal}>{t.source_text}</Text>
                      <View style={styles.inlineDivider} />
                      <Text style={styles.textLabel}>TRANSLATION</Text>
                      <Text style={styles.targetVal}>{t.translated_text}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyDetailText}>No speaker turns recorded.</Text>
                )}
              </View>
            )}

            {/* Voice clone detail layout */}
            {selectedSession?.tool === 'voice_clone' && (
              <View style={styles.translationDetailCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.textLabel}>VOICE PROFILE INFO</Text>
                  {signedInputUrl && (
                    <AudioPlayButton audioUrl={signedInputUrl} />
                  )}
                </View>
                <Text style={styles.sourceVal}>Profile: {selectedSession.title?.replace('Voice Clone: ', '')}</Text>
                <Text style={styles.targetVal}>{selectedSession.source_text}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Advanced Filter Bottom Sheet */}
      <Modal
        visible={showFilterSheet}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFilterSheet(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterSheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filter by Language</Text>
              <Pressable onPress={() => setShowFilterSheet(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.sheetBody}>
              <Pressable 
                style={[styles.filterRowItem, !selectedLanguageFilter && styles.filterRowItemActive]}
                onPress={() => {
                  setSelectedLanguageFilter(null);
                  setShowFilterSheet(false);
                }}
              >
                <Text style={[styles.filterRowText, !selectedLanguageFilter && styles.filterRowTextActive]}>
                  All Languages
                </Text>
              </Pressable>

              <Pressable 
                style={[styles.filterRowItem, selectedLanguageFilter === 'en' && styles.filterRowItemActive]}
                onPress={() => {
                  setSelectedLanguageFilter('en');
                  setShowFilterSheet(false);
                }}
              >
                <Text style={[styles.filterRowText, selectedLanguageFilter === 'en' && styles.filterRowTextActive]}>
                  English
                </Text>
              </Pressable>

              <Pressable 
                style={[styles.filterRowItem, selectedLanguageFilter === 'es' && styles.filterRowItemActive]}
                onPress={() => {
                  setSelectedLanguageFilter('es');
                  setShowFilterSheet(false);
                }}
              >
                <Text style={[styles.filterRowText, selectedLanguageFilter === 'es' && styles.filterRowTextActive]}>
                  Spanish
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
  headerTitle: {
    fontSize: 18,
    fontFamily: typography.heading3.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filterTrigger: {
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
    color: colors.textPrimary,
  },
  chipsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontFamily: typography.captionMedium.fontFamily,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  historyCard: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted,
  },
  langPairLabel: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
    color: colors.textMuted,
  },
  cardTime: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
    color: colors.textSubtle,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: typography.heading4.fontFamily,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    color: colors.textMuted,
    textAlign: 'center',
  },
  detailContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  detailHeaderTitle: {
    fontSize: 18,
    fontFamily: typography.heading3.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  detailLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailScroll: {
    padding: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaLangs: {
    fontSize: 12,
    fontFamily: typography.captionMedium.fontFamily,
    color: colors.textMuted,
  },
  detailTitle: {
    fontSize: 22,
    fontFamily: typography.heading2.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  detailSectionHeading: {
    fontSize: 13,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  translationDetailCard: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  textLabel: {
    fontSize: 9,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  sourceVal: {
    fontSize: 15,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 12,
  },
  inlineDivider: {
    height: 1,
    backgroundColor: 'rgba(9, 9, 9, 0.05)',
    marginVertical: 12,
  },
  targetVal: {
    fontSize: 16,
    fontFamily: typography.bodySemibold.fontFamily,
    color: colors.accentPurple,
    lineHeight: 22,
  },
  translitBox: {
    backgroundColor: 'rgba(124, 108, 208, 0.05)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  translitLabel: {
    fontSize: 8,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.accentPurple,
    marginBottom: 4,
  },
  translitVal: {
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyDetailText: {
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
    color: colors.textMuted,
  },
  summaryBox: {
    backgroundColor: colors.surfaceWarning,
    borderWidth: 1,
    borderColor: '#F9E5C9',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 13,
    fontFamily: typography.bodySemibold.fontFamily,
    color: colors.warning,
  },
  summaryText: {
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  filterSheetCard: {
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
    gap: 10,
  },
  filterRowItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterRowItemActive: {
    backgroundColor: 'rgba(124, 108, 208, 0.08)',
    borderColor: colors.accentPurple,
  },
  filterRowText: {
    fontSize: 15,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
  },
  filterRowTextActive: {
    color: colors.accentPurple,
    fontWeight: '700',
  },
  audioPlayBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 108, 208, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannedImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 12,
  },
  foodReportCard: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  foodReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderColor: 'rgba(9, 9, 9, 0.05)',
    paddingBottom: 10,
    marginBottom: 12,
  },
  foodReportTitle: {
    fontSize: 16,
    fontFamily: typography.heading3.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  foodReportSubTitle: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
    color: colors.textMuted,
    marginTop: 2,
  },
  matchBadge: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#31C48D',
  },
  matchBadgeText: {
    fontSize: 10,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: '#03543F',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  macroItem: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroValue: {
    fontSize: 14,
    fontFamily: typography.heading4.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  macroLabel: {
    fontSize: 8,
    fontFamily: typography.captionMedium.fontFamily,
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  allergenAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE8E8',
    borderWidth: 1,
    borderColor: '#F8B4B4',
    borderRadius: 12,
    padding: 10,
  },
  allergenAlertText: {
    fontSize: 11,
    fontFamily: typography.captionMedium.fontFamily,
    color: '#9B1C1C',
    marginLeft: 8,
    flex: 1,
  },
  ocrRegionsCard: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  ocrRegionItem: {
    paddingVertical: 12,
  },
  ocrRegionDivider: {
    borderBottomWidth: 1,
    borderColor: 'rgba(9, 9, 9, 0.05)',
  },
  ocrRegionSource: {
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    color: colors.textMuted,
    marginBottom: 2,
  },
  ocrRegionTarget: {
    fontSize: 14,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
  },
});
