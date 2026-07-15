import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Image,
  Alert,
  Clipboard,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';

import { colors } from '../constants/colors';
import { spacing, layout, shadows } from '../constants/spacing';
import { typography } from '../constants/typography';
import { getLanguageByCode } from '../constants/languages';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { historyService } from '../services/historyService';
import { useTheme, useThemeStyles } from '../contexts/ThemeContext';

type SessionTypeFilter = 'all' | 'type' | 'voice' | 'camera' | 'conversation' | 'accent_changer' | 'voice_clone';

// Web-safe Audio Player Button
function WebAudioPlayerButton({ audioUrl, isPlaying, setIsPlaying, styles }: any) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((e) => console.warn('[Web Audio] failed:', e));
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <Pressable onPress={togglePlay} style={styles.audioPlayBtn}>
      <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color="#FFFFFF" />
    </Pressable>
  );
}

// Native-safe Audio Player Button
function NativeAudioPlayerButton({ audioUrl, isPlaying, setIsPlaying, styles }: any) {
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
      <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color="#FFFFFF" />
    </Pressable>
  );
}

function AudioPlayButton({ audioUrl }: { audioUrl: string }) {
  const styles = useThemeStyles(createStyles);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebAudioPlayerButton
          audioUrl={audioUrl}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          styles={styles}
        />
      ) : (
        <NativeAudioPlayerButton
          audioUrl={audioUrl}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          styles={styles}
        />
      )}
    </>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const styles = useThemeStyles(createStyles);
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SessionTypeFilter>('all');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<string | null>(null);

  // Detail Modal state
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [signedInputUrl, setSignedInputUrl] = useState<string | null>(null);
  const [signedOutputUrl, setSignedOutputUrl] = useState<string | null>(null);

  // Fetch unified activity_history
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

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return historyService.deleteActivity(id);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['activityHistory', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['practiceAnalytics', user?.id] });
      setSelectedSession(null);
    },
    onError: (err: any) => {
      Alert.alert('Delete Failed', err.message || 'Could not delete history item.');
    },
  });

  const handleDeleteItem = (id: string) => {
    Alert.alert('Delete Record', 'Are you sure you want to permanently delete this history record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMutation.mutate(id);
        },
      },
    ]);
  };

  const handleExportItem = async (session: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await historyService.exportActivity(session, 'text');
      Alert.alert('Exported', 'The text file has been downloaded.');
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'Failed to export.');
    }
  };

  const handleCopyText = (text: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Clipboard.setString(text);
    Alert.alert('Copied', 'Text copied to clipboard.');
  };

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
    const matchesSearch =
      sess.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sess.source_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sess.translated_text?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = activeFilter === 'all' || sess.tool === activeFilter;

    const matchesLang =
      !selectedLanguageFilter ||
      sess.source_language === selectedLanguageFilter ||
      sess.target_language === selectedLanguageFilter;

    return matchesSearch && matchesType && matchesLang;
  });

  const handleSelectSession = (session: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSession(session);
  };

  const handleDismissDetail = () => {
    setSelectedSession(null);
  };

  // Determine sticky-note colors based on tool type
  const getNoteStyles = (tool: string) => {
    switch (tool) {
      case 'type':
        return { bg: isDark ? '#2C2518' : '#FFFDF3', border: isDark ? '#DFB65D' : '#F4DFB1', tag: 'Text' };
      case 'voice':
        return { bg: isDark ? '#241E34' : '#F9F7FF', border: isDark ? '#7E6CD5' : '#E6E1F9', tag: 'Voice' };
      case 'camera':
        return { bg: isDark ? '#14251B' : '#F4FAF6', border: isDark ? '#3D8E5F' : '#D1ECE0', tag: 'Camera' };
      case 'conversation':
        return { bg: isDark ? '#2D2018' : '#FFF9F5', border: isDark ? '#C76A28' : '#FADCC6', tag: 'Talk' };
      default:
        return { bg: isDark ? '#222B38' : '#F6F9FD', border: isDark ? '#4B77BE' : '#DBE6F5', tag: 'System' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Translation Memory</Text>
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
          {([
            'all',
            'type',
            'voice',
            'camera',
            'conversation',
            'accent_changer',
            'voice_clone',
          ] as SessionTypeFilter[]).map((type) => {
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
                  {type === 'type'
                    ? 'Text'
                    : type === 'accent_changer'
                    ? 'Accent'
                    : type === 'voice_clone'
                    ? 'Clone'
                    : type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main List */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.accentPurple} />
        </View>
      ) : filteredSessions.length > 0 ? (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {filteredSessions.map((session) => {
            const noteCfg = getNoteStyles(session.tool);
            const sourceLangName = getLanguageByCode(session.source_language || 'en')?.name || 'English';
            const targetLangName = getLanguageByCode(session.target_language || 'es')?.name || 'Spanish';

            return (
              <View key={session.id} style={styles.layeredMemoContainer}>
                {/* Visual stacked offset paper layers */}
                <View style={[styles.memoBgLayer, { backgroundColor: noteCfg.bg, borderColor: noteCfg.border, bottom: -4, right: -4, zIndex: 1 }]} />
                <View style={[styles.memoBgLayer, { backgroundColor: noteCfg.bg, borderColor: noteCfg.border, bottom: -2, right: -2, zIndex: 2 }]} />
                
                <Pressable
                  style={[styles.memoNoteCard, { backgroundColor: noteCfg.bg, borderColor: noteCfg.border }]}
                  onPress={() => handleSelectSession(session)}
                >
                  {/* Folded corner tag */}
                  <View style={[styles.memoFoldTag, { borderTopColor: noteCfg.border, borderRightColor: noteCfg.border }]} />

                  {/* Header tags */}
                  <View style={styles.memoHeader}>
                    <View style={styles.memoTagBadge}>
                      <Text style={[styles.memoTagText, { color: isDark ? colors.textPrimary : colors.textSecondary }]}>
                        {noteCfg.tag.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.memoTime}>
                      {new Date(session.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>

                  {/* Body Contents */}
                  <View style={styles.memoBody}>
                    {session.tool === 'type' && (
                      <View>
                        <Text style={styles.memoSourceText} numberOfLines={2}>"{session.source_text}"</Text>
                        <Text style={styles.memoTranslationText} numberOfLines={2}>{session.translated_text}</Text>
                      </View>
                    )}

                    {session.tool === 'voice' && (
                      <View>
                        <View style={styles.memoVoiceRow}>
                          <Ionicons name="mic" size={14} color={colors.accentPurple} style={{ marginRight: 6 }} />
                          <View style={styles.miniWaveform}>
                            {[8, 16, 12, 18, 10, 14, 6, 12].map((h, i) => (
                              <View key={i} style={[styles.miniWaveBar, { height: h, backgroundColor: colors.accentPurple }]} />
                            ))}
                          </View>
                        </View>
                        <Text style={styles.memoSourceText} numberOfLines={2}>"{session.source_text || 'Voice clip transcript'}"</Text>
                        <Text style={styles.memoTranslationText} numberOfLines={2}>{session.translated_text}</Text>
                      </View>
                    )}

                    {session.tool === 'camera' && (
                      <View style={styles.memoCameraLayout}>
                        {session.thumbnail_path ? (
                          <View style={styles.memoThumbnailWrapper}>
                            <Ionicons name="image-outline" size={24} color={colors.textSubtle} />
                          </View>
                        ) : (
                          <View style={styles.memoIconWrapper}>
                            <Ionicons name="camera-outline" size={22} color={colors.accentGreen} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memoCategoryLabel}>
                            {session.metadata?.category?.toUpperCase() || 'OBJECT SCAN'}
                          </Text>
                          <Text style={styles.memoCameraTitle} numberOfLines={1}>{session.title}</Text>
                          <Text style={styles.memoCameraDesc} numberOfLines={1}>
                            {session.translated_text || session.source_text}
                          </Text>
                        </View>
                      </View>
                    )}

                    {session.tool === 'conversation' && (
                      <View>
                        <Text style={styles.memoConvoHeader}>Dialogue turns: {session.transcript?.length || 2}</Text>
                        <View style={styles.memoConvoLine}>
                          <Text style={styles.memoConvoSpeaker}>EN:</Text>
                          <Text style={styles.memoConvoQuote} numberOfLines={1}>
                            {session.transcript?.[0]?.source_text || session.source_text}
                          </Text>
                        </View>
                        <View style={styles.memoConvoLine}>
                          <Text style={[styles.memoConvoSpeaker, { color: colors.accentPurple }]}>ES:</Text>
                          <Text style={[styles.memoConvoQuote, { fontWeight: '600' }]} numberOfLines={1}>
                            {session.transcript?.[0]?.translated_text || session.translated_text}
                          </Text>
                        </View>
                      </View>
                    )}

                    {session.tool === 'accent_changer' && (
                      <View>
                        <Text style={styles.memoAccentLabel}>Accent: {session.metadata?.targetAccent || 'British'}</Text>
                        <Text style={styles.memoSourceText} numberOfLines={2}>"{session.source_text}"</Text>
                      </View>
                    )}

                    {session.tool === 'voice_clone' && (
                      <View>
                        <Text style={styles.memoAccentLabel}>Voice Profile: {session.title?.replace('Voice Clone: ', '')}</Text>
                        <Text style={styles.memoSourceText} numberOfLines={2}>"{session.source_text}"</Text>
                      </View>
                    )}
                  </View>

                  {/* Footer & Languages */}
                  <View style={styles.memoFooter}>
                    <Text style={styles.memoLangBadge}>
                      {sourceLangName} → {targetLangName}
                    </Text>
                    
                    {/* Inline Quick Action Icons */}
                    <View style={styles.memoActionRow}>
                      <Pressable
                        style={styles.memoIconAction}
                        onPress={() => handleCopyText(session.translated_text || session.source_text || '')}
                        accessibilityLabel="Copy text"
                      >
                        <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable
                        style={styles.memoIconAction}
                        onPress={() => handleExportItem(session)}
                        accessibilityLabel="Export TXT"
                      >
                        <Ionicons name="download-outline" size={14} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable
                        style={styles.memoIconAction}
                        onPress={() => handleDeleteItem(session.id)}
                        accessibilityLabel="Delete item"
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              </View>
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
              {selectedSession?.source_language && selectedSession?.target_language && (
                <Text style={styles.metaLangs}>
                  {getLanguageByCode(selectedSession.source_language)?.name} → {getLanguageByCode(selectedSession.target_language)?.name}
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

            {/* Modal level detail actions */}
            <View style={styles.detailActionsContainer}>
              <Pressable
                style={[styles.detailActionBtn, { backgroundColor: colors.backgroundSoft, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => handleExportItem(selectedSession)}
              >
                <Ionicons name="download-outline" size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.detailActionText}>Export Text</Text>
              </Pressable>
              <Pressable
                style={[styles.detailActionBtn, { backgroundColor: colors.errorLight }]}
                onPress={() => handleDeleteItem(selectedSession.id)}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={[styles.detailActionText, { color: colors.error }]}>Delete</Text>
              </Pressable>
            </View>
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

const createStyles = (colors: any) =>
  StyleSheet.create({
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
      fontWeight: '700',
      color: colors.textPrimary,
    },
    filterTrigger: {
      padding: 4,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSoft,
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
    },
    chipsContainer: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.backgroundSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.textInverse,
    },
    listContainer: {
      paddingHorizontal: 20,
      paddingBottom: layout.tabBarHeight + 30,
      gap: 16,
    },
    layeredMemoContainer: {
      position: 'relative',
      marginRight: 4,
      marginBottom: 6,
    },
    memoBgLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      borderRadius: 16,
      borderWidth: 1,
    },
    memoNoteCard: {
      position: 'relative',
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      zIndex: 10,
      ...shadows.sm,
    },
    memoFoldTag: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 0,
      height: 0,
      borderStyle: 'solid',
      borderTopWidth: 12,
      borderRightWidth: 12,
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderBottomColor: 'transparent',
      borderLeftColor: 'transparent',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 0,
    },
    memoHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      marginRight: 10, // Avoid overlapping the fold tag
    },
    memoTagBadge: {
      backgroundColor: colors.backgroundSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    memoTagText: {
      fontSize: 9,
      fontWeight: '800',
    },
    memoTime: {
      fontSize: 11,
      color: colors.textSubtle,
      fontWeight: '500',
    },
    memoBody: {
      marginBottom: 12,
    },
    memoSourceText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 6,
    },
    memoTranslationText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 20,
    },
    memoVoiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    miniWaveform: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    miniWaveBar: {
      width: 2,
      borderRadius: 1,
    },
    memoCameraLayout: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    memoThumbnailWrapper: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memoIconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.backgroundSoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    memoCategoryLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.accentGreen,
      marginBottom: 2,
    },
    memoCameraTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    memoCameraDesc: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    memoConvoHeader: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    memoConvoLine: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      marginBottom: 2,
    },
    memoConvoSpeaker: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSubtle,
      width: 22,
    },
    memoConvoQuote: {
      fontSize: 13,
      color: colors.textPrimary,
      flex: 1,
    },
    memoAccentLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.accentOrange,
      marginBottom: 4,
    },
    memoFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 0.5,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    memoLangBadge: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    memoActionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    memoIconAction: {
      padding: 4,
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
      color: colors.textPrimary,
      fontWeight: '700',
      marginBottom: 6,
    },
    emptyDesc: {
      fontSize: 13,
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
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeButton: {
      padding: 4,
    },
    detailScroll: {
      padding: 24,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    typeBadge: {
      backgroundColor: colors.backgroundSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    metaLangs: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    detailTitle: {
      fontSize: 22,
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
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
    },
    translationDetailCard: {
      backgroundColor: colors.backgroundSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    textLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 6,
    },
    sourceVal: {
      fontSize: 15,
      color: colors.textPrimary,
      lineHeight: 20,
      marginBottom: 12,
    },
    inlineDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    targetVal: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.accentPurple,
      lineHeight: 22,
    },
    scannedImage: {
      width: '100%',
      height: 220,
      borderRadius: 16,
    },
    foodReportCard: {
      backgroundColor: colors.backgroundSoft,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    foodReportHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    foodReportTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    foodReportSubTitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    matchBadge: {
      backgroundColor: colors.successLight,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    matchBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.success,
    },
    macroRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    macroItem: {
      alignItems: 'center',
      flex: 1,
    },
    macroValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    macroLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: 2,
    },
    allergenAlertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.warningLight,
      borderRadius: 10,
      padding: 10,
      gap: 8,
    },
    allergenAlertText: {
      fontSize: 12,
      color: colors.warning,
      fontWeight: '600',
      flex: 1,
    },
    audioPlayBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.accentPurple,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyDetailText: {
      fontSize: 13,
      color: colors.textSubtle,
      fontStyle: 'italic',
    },
    detailActionsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
      marginBottom: 40,
    },
    detailActionBtn: {
      flex: 1,
      flexDirection: 'row',
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailActionText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    filterSheetCard: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 36,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sheetBody: {
      gap: 8,
    },
    filterRowItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    filterRowItemActive: {
      backgroundColor: colors.backgroundSoft,
    },
    filterRowText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    filterRowTextActive: {
      color: colors.accentPurple,
      fontWeight: '700',
    },
  });
