import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  SafeAreaView,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAudioPlayer, RecordingPresets, AudioModule } from 'expo-audio';
import { useAppAudioRecorder, useAppAudioRecorderState } from '../../utils/audioRecorder';

import { colors } from '../../constants/colors';
import { spacing, layout, shadows } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { languages, getLanguageName } from '../../constants/languages';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { elevenLabsService } from '../../services/elevenLabs';
import { generateUUID } from '../../utils/uuid';
import { useCreateActivity, useActivityHistoryList, useDeleteActivity } from '../../hooks/useActivityHistory';
import { historyService } from '../../services/historyService';

interface TranscriptSegment {
  speaker: 'top' | 'bottom';
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: Date;
}

export default function ConverseTab() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentRequestId, setCurrentRequestId] = useState(generateUUID());
  const [playingHistoryId, setPlayingHistoryId] = useState<string | null>(null);
  const historyAudioPlayer = useAudioPlayer('');

  const createActivityMutation = useCreateActivity();
  const deleteActivityMutation = useDeleteActivity();
  const { data: history = [], isLoading: loadingHistory } = useActivityHistoryList({ tool: 'conversation', limit: 5 });

  // Language Setup
  const [topLanguage, setTopLanguage] = useState('es');
  const [bottomLanguage, setBottomLanguage] = useState('en');
  const [activeLangModal, setActiveLangModal] = useState<'top' | 'bottom' | null>(null);

  // Layout & Settings
  const [isFaceToFace, setIsFaceToFace] = useState(true);
  const [realtimeMode, setRealtimeMode] = useState<'websocket' | 'http_fallback'>('websocket');
  const [vadEnabled, setVadEnabled] = useState(false);

  // Conversation States
  const [activeSpeaker, setActiveSpeaker] = useState<'top' | 'bottom' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [currentSpeechText, setCurrentSpeechText] = useState('');
  const sessionIdRef = useRef<string | null>(null);

  // Audio Recorder & Player setup
  const recorder = useAppAudioRecorder({
    isMeteringEnabled: true,
  });
  const recorderState = useAppAudioRecorderState(recorder, 100);
  const player = useAudioPlayer('');

  // Refs for auto-scroll
  const topScrollRef = useRef<ScrollView>(null);
  const bottomScrollRef = useRef<ScrollView>(null);
  const vadTimerRef = useRef<any>(null);
  const volumeIntervalRef = useRef<any>(null);

  // Real Auto Segment Detection (VAD) Timeout
  useEffect(() => {
    if (activeSpeaker && isRecording) {
      if (vadEnabled) {
        vadTimerRef.current = setTimeout(() => {
          handleStopRecording();
        }, 5000); // Stop automatically after 5s
      }

      return () => {
        if (vadTimerRef.current) clearTimeout(vadTimerRef.current);
      };
    } else {
      setCurrentSpeechText('');
    }
  }, [activeSpeaker, isRecording, vadEnabled]);

  // Scroll to bottom when transcripts grow
  useEffect(() => {
    setTimeout(() => {
      topScrollRef.current?.scrollToEnd({ animated: true });
      bottomScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [transcripts, currentSpeechText]);

  // Mutations to save session
  const saveSessionMutation = useMutation<any, any, void>({
    mutationFn: async () => {
      if (!user) throw new Error('You must be signed in.');

      if (!sessionIdRef.current) throw new Error('No saved conversation session was found.');

      const { data: existingSession, error: existingSessionError } = await (supabase as any)
        .from('translation_sessions')
        .select('metadata')
        .eq('id', sessionIdRef.current)
        .eq('user_id', user.id)
        .single();
      if (existingSessionError) throw existingSessionError;

      const { data: session, error: sessionErr } = await (supabase as any)
        .from('translation_sessions')
        .update({
          status: 'completed',
          metadata: {
            ...((existingSession as any)?.metadata || {}),
            isFaceToFace,
            realtimeMode,
            totalSegments: transcripts.length,
            topLanguage,
            bottomLanguage,
          },
        } as any)
        .eq('id', sessionIdRef.current)
        .eq('user_id', user.id)
        .select()
        .single();

      if (sessionErr) throw sessionErr;
      return session;
    },
    onSuccess: async (session) => {
      // Save to unified activity_history in Supabase
      if (user && session) {
        try {
          await createActivityMutation.mutateAsync({
            client_request_id: currentRequestId,
            tool: 'conversation',
            operation_type: 'conversation_session',
            title: `Conversation (${getLanguageName(topLanguage)} / ${getLanguageName(bottomLanguage)})`,
            transcript: transcripts.map(t => ({
              speaker: t.speaker === 'bottom' ? 'A' : 'B',
              language: t.sourceLang,
              source_text: t.sourceText,
              translated_text: t.translatedText,
            })),
            metadata: {
              session_id: session.id,
              totalSegments: transcripts.length,
              isFaceToFace,
              realtimeMode
            }
          });
        } catch (historyErr) {
          console.error('Failed to save conversation session to unified history:', historyErr);
        }
      }

      // Generate a fresh request ID for the next conversation
      setCurrentRequestId(generateUUID());

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Session Saved', 'The bilingual transcript and summary are ready.', [
        {
          text: 'View Summary',
          onPress: () => router.push(`/conversation-summary?sessionId=${(session as any).id}`),
        },
      ]);
    },
    onError: (err) => {
      Alert.alert('Save Error', err.message);
    },
  });

  const getMeteringHeights = () => {
    // Decibels range from approx -60 (silence) to 0 (max volume)
    const db = recorderState?.metering ?? -60;
    const norm = Math.max(0, Math.min(1, (db + 60) / 60));
    // Generate 5 bars based on the current level
    return [
      Math.max(10, norm * 45 + Math.random() * 5),
      Math.max(10, norm * 55 + Math.random() * 8),
      Math.max(10, norm * 65 + Math.random() * 10),
      Math.max(10, norm * 55 + Math.random() * 8),
      Math.max(10, norm * 45 + Math.random() * 5),
    ];
  };

  const handlePressMic = async (side: 'top' | 'bottom') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isRecording) {
      if (activeSpeaker === side) {
        await handleStopRecording();
      }
      return;
    }

    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Microphone recording permission is required.');
      return;
    }

    try {
      setActiveSpeaker(side);
      setIsRecording(true);
      setStatusText('Listening...');
      await recorder.record();
    } catch (e: any) {
      console.error(e);
      setIsRecording(false);
      setActiveSpeaker(null);
    }
  };

  const handleStopRecording = async () => {
    if (!activeSpeaker) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const speaker = activeSpeaker;
    setIsRecording(false);
    setActiveSpeaker(null);
    setIsProcessing(true);
    setStatusText('Processing...');

    try {
      const completedUri = await recorder.stop();
      const audioUri = completedUri || recorder.uri;
      if (!audioUri) {
        throw new Error('No recorded audio file found.');
      }

      const sourceLang = speaker === 'top' ? topLanguage : bottomLanguage;
      const targetLang = speaker === 'top' ? bottomLanguage : topLanguage;

      setStatusText('Transcribing, translating, and saving...');
      const result = await elevenLabsService.translateVoice(audioUri, {
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        voiceId: speaker === 'top' ? 'JBFqnCBsd6RMkjVDRZzb' : '21m00Tcm4TlvDq8ikWAM',
        sessionId: sessionIdRef.current || undefined,
        sessionType: 'conversation',
        speakerId: speaker === 'bottom' ? 'A' : 'B',
        sequenceNumber: transcripts.length + 1,
      });
      if (!sessionIdRef.current) {
        sessionIdRef.current = result.session_id;
      }

      const sourceText = result.source_text;
      const translatedText = result.translated_text;

      if (result.generated_audio_url) {
        player.replace({ uri: result.generated_audio_url });
        player.play();
      }

      const newSegment: TranscriptSegment = {
        speaker: speaker,
        sourceText: sourceText,
        translatedText: translatedText,
        sourceLang: sourceLang,
        targetLang: targetLang,
        timestamp: new Date(),
      };

      setTranscripts(prev => [...prev, newSegment]);
      setIsProcessing(false);
      setStatusText('');
    } catch (err: any) {
      console.error(err);
      setIsProcessing(false);
      setStatusText('');
      Alert.alert('Voice Pipeline Failed', err.message || 'An error occurred during voice turnaround.');
    }
  };

  const handleFinishSession = () => {
    if (transcripts.length === 0) {
      Alert.alert('Empty Transcript', 'Please record some speech before finishing.');
      return;
    }
    
    Alert.alert(
      'Finish Conversation',
      'Are you sure you want to end this conversation and generate an AI summary?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Finish & Summarize', 
          onPress: () => saveSessionMutation.mutate(),
        }
      ]
    );
  };

  const handleReset = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (sessionIdRef.current && user?.id) {
      await (supabase as any)
        .from('translation_sessions')
        .update({ status: 'cancelled' } as any)
        .eq('id', sessionIdRef.current)
        .eq('user_id', user.id);
    }
    setTranscripts([]);
    sessionIdRef.current = null;
  };

  const selectLanguage = (code: string) => {
    Haptics.selectionAsync();
    if (activeLangModal === 'top') {
      setTopLanguage(code);
    } else if (activeLangModal === 'bottom') {
      setBottomLanguage(code);
    }
    setActiveLangModal(null);
  };

  const handleSelectHistoryItem = (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sessionIdRef.current = item.metadata?.session_id || null;
    if (item.transcript && Array.isArray(item.transcript)) {
      const segments: TranscriptSegment[] = item.transcript.map((t: any) => ({
        speaker: t.speaker === 'A' ? 'bottom' : 'top',
        sourceText: t.source_text,
        translatedText: t.translated_text,
        sourceLang: t.language,
        targetLang: t.language === topLanguage ? bottomLanguage : topLanguage,
        timestamp: new Date(),
      }));
      setTranscripts(segments);
    }
  };

  const handleDeleteHistoryItem = (itemId: string) => {
    Alert.alert(
      'Delete History Item',
      'Are you sure you want to delete this conversation from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await deleteActivityMutation.mutateAsync(itemId);
              Alert.alert('Success', 'History item deleted.');
            } catch (err: any) {
              Alert.alert('Deletion Error', err.message || 'Failed to delete history item.');
            }
          }
        }
      ]
    );
  };

  const handleExportHistoryItem = async (item: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await historyService.exportActivity(item);
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export conversation.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.processingText}>{statusText}</Text>
        </View>
      )}

      {/* Top Participant Panel (Rotated or Standard) */}
      <View style={[
        styles.speakerPanel,
        styles.topPanel,
        activeSpeaker === 'top' && styles.activePanelGlow,
        isFaceToFace && styles.rotatedContainer
      ]}>
        {/* Language & Rotation controls */}
        <View style={styles.panelHeader}>
          <Pressable 
            style={styles.langSelector}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveLangModal('top');
            }}
          >
            <Text style={styles.langSelectorText}>{getLanguageName(topLanguage).toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textPrimary} style={{ marginLeft: 4 }} />
          </Pressable>
          
          <Pressable
            style={styles.controlIconBtn}
            onPress={() => {
              Haptics.selectionAsync();
              setIsFaceToFace(!isFaceToFace);
            }}
          >
            <Ionicons 
              name={isFaceToFace ? "sync-outline" : "sync"} 
              size={18} 
              color={colors.primary} 
            />
            <Text style={styles.smallControlText}>Face-to-Face</Text>
          </Pressable>
        </View>

        {/* Top Transcript Area */}
        <ScrollView 
          ref={topScrollRef}
          style={styles.transcriptScrollView} 
          contentContainerStyle={styles.transcriptScrollContent}
        >
          {transcripts.map((t, idx) => (
            <View 
              key={idx} 
              style={[
                styles.bubble, 
                t.speaker === 'top' ? styles.bubblePrimary : styles.bubbleSecondary
              ]}
            >
              <Text style={styles.bubbleLang}>{getLanguageName(t.sourceLang).toUpperCase()}</Text>
              <Text style={styles.bubbleText}>{t.sourceText}</Text>
              <View style={styles.bubbleDivider} />
              <Text style={styles.bubbleLangTranslated}>{getLanguageName(t.targetLang).toUpperCase()}</Text>
              <Text style={styles.bubbleTextTranslated}>{t.translatedText}</Text>
            </View>
          ))}
          {activeSpeaker === 'top' && isRecording && (
            <View style={[styles.bubble, styles.bubbleRecording]}>
              <Text style={styles.recordingLabel}>Listening...</Text>
              <Text style={styles.streamingText}>
                {currentSpeechText || 'Speak now...'}
              </Text>
              <View style={styles.waveRow}>
                {getMeteringHeights().map((vol, i) => (
                  <View key={i} style={[styles.waveBar, { height: vol, backgroundColor: colors.accentBlue }]} />
                ))}
              </View>
            </View>
          )}
          {transcripts.length === 0 && !activeSpeaker && (
            <View style={styles.emptyTranscriptContainer}>
              <Text style={styles.emptyTranscriptText}>
                Presione el micrófono para comenzar a hablar
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Top Mic Button */}
        <View style={styles.micRow}>
          <Pressable
            style={({ pressed }) => [
              styles.micButton,
              pressed && styles.buttonPressed,
              activeSpeaker === 'top' && styles.micButtonActive
            ]}
            onPress={() => handlePressMic('top')}
            disabled={activeSpeaker === 'bottom' && isRecording}
          >
            <Ionicons 
              name={activeSpeaker === 'top' ? 'stop' : 'mic'} 
              size={28} 
              color={activeSpeaker === 'top' ? colors.textInverse : colors.textPrimary} 
            />
          </Pressable>
        </View>
      </View>

      {/* Center Control Divider */}
      <View style={styles.centerBar}>
        <View style={styles.centerBarLine} />
        
        {/* Realtime mode option switcher badge */}
        <Pressable 
          style={styles.fallbackBadge}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setRealtimeMode(prev => prev === 'websocket' ? 'http_fallback' : 'websocket');
          }}
        >
          <Ionicons 
            name={realtimeMode === 'websocket' ? "wifi" : "flash-off"} 
            size={12} 
            color={realtimeMode === 'websocket' ? colors.success : colors.warning} 
            style={{ marginRight: 4 }}
          />
          <Text style={styles.fallbackBadgeText}>
            {realtimeMode === 'websocket' ? 'WebSocket (Realtime)' : 'HTTP (Fallback)'}
          </Text>
        </Pressable>

        {/* VAD Settings Switch */}
        <View style={styles.vadRow}>
          <Text style={styles.vadLabel}>Auto-VAD</Text>
          <Switch
            value={vadEnabled}
            onValueChange={(val) => {
              Haptics.selectionAsync();
              setVadEnabled(val);
            }}
            thumbColor={colors.primary}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
          />
        </View>

        {/* Finish & Reset Buttons */}
        <View style={styles.centerActions}>
          <Pressable style={styles.iconActionBtn} onPress={handleReset}>
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </Pressable>
          <Pressable 
            style={[styles.finishBtn, saveSessionMutation.isPending && styles.finishBtnDisabled]} 
            onPress={handleFinishSession}
            disabled={saveSessionMutation.isPending}
          >
            {saveSessionMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <>
                <Text style={styles.finishBtnText}>Finish</Text>
                <Ionicons name="sparkles" size={14} color={colors.textInverse} style={{ marginLeft: 4 }} />
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.centerBarLine} />
      </View>

      {/* Bottom Participant Panel */}
      <View style={[
        styles.speakerPanel,
        styles.bottomPanel,
        activeSpeaker === 'bottom' && styles.activePanelGlow
      ]}>
        {/* Language label & control */}
        <View style={styles.panelHeader}>
          <Pressable 
            style={styles.langSelector}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveLangModal('bottom');
            }}
          >
            <Text style={styles.langSelectorText}>{getLanguageName(bottomLanguage).toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textPrimary} style={{ marginLeft: 4 }} />
          </Pressable>
          <Text style={styles.instructionLabel}>Tap mic to speak</Text>
        </View>

        {/* Bottom Transcript Area */}
        <ScrollView 
          ref={bottomScrollRef}
          style={styles.transcriptScrollView} 
          contentContainerStyle={styles.transcriptScrollContent}
        >
          {transcripts.map((t, idx) => (
            <View 
              key={idx} 
              style={[
                styles.bubble, 
                t.speaker === 'bottom' ? styles.bubblePrimary : styles.bubbleSecondary
              ]}
            >
              <Text style={styles.bubbleLang}>{getLanguageName(t.sourceLang).toUpperCase()}</Text>
              <Text style={styles.bubbleText}>{t.sourceText}</Text>
              <View style={styles.bubbleDivider} />
              <Text style={styles.bubbleLangTranslated}>{getLanguageName(t.targetLang).toUpperCase()}</Text>
              <Text style={styles.bubbleTextTranslated}>{t.translatedText}</Text>
            </View>
          ))}
          {activeSpeaker === 'bottom' && isRecording && (
            <View style={[styles.bubble, styles.bubbleRecording]}>
              <Text style={styles.recordingLabel}>Listening...</Text>
              <Text style={styles.streamingText}>
                {currentSpeechText || 'Speak now...'}
              </Text>
              <View style={styles.waveRow}>
                {getMeteringHeights().map((vol, i) => (
                  <View key={i} style={[styles.waveBar, { height: vol, backgroundColor: colors.accentPurple }]} />
                ))}
              </View>
            </View>
          )}
          {transcripts.length === 0 && !activeSpeaker && (
            <View style={styles.historyContainer}>
              <Text style={styles.sectionHeader}>Recent Conversations</Text>
              {loadingHistory ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
              ) : history && history.length > 0 ? (
                history.map((item) => (
                  <View key={item.id} style={styles.historyCard}>
                    <Pressable style={styles.historyCardBody} onPress={() => handleSelectHistoryItem(item)}>
                      <View style={styles.historyCardHeader}>
                        <Text style={styles.historyCardMeta} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.historyCardTime}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                        </Text>
                      </View>
                      <Text style={styles.historySourceText} numberOfLines={2}>
                        {Array.isArray(item.transcript) ? `${item.transcript.length} turns` : 'Conversation session'}
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
                <Text style={styles.emptyHistoryText}>No past conversations. Tap mic to begin speaking.</Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* Bottom Mic Button */}
        <View style={styles.micRow}>
          <Pressable
            style={({ pressed }) => [
              styles.micButton,
              pressed && styles.buttonPressed,
              activeSpeaker === 'bottom' && styles.micButtonActive
            ]}
            onPress={() => handlePressMic('bottom')}
            disabled={activeSpeaker === 'top' && isRecording}
          >
            <Ionicons 
              name={activeSpeaker === 'bottom' ? 'stop' : 'mic'} 
              size={28} 
              color={activeSpeaker === 'bottom' ? colors.textInverse : colors.textPrimary} 
            />
          </Pressable>
        </View>
      </View>

      {/* Language Picker Modal */}
      <Modal
        visible={activeLangModal !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveLangModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Language</Text>
              <Pressable onPress={() => setActiveLangModal(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView style={styles.languagesList} showsVerticalScrollIndicator={false}>
              {languages.map((lang) => (
                <Pressable
                  key={lang.code}
                  style={styles.languageItem}
                  onPress={() => selectLanguage(lang.code)}
                >
                  <Text style={styles.languageItemText}>{lang.name}</Text>
                  <Text style={styles.languageItemNative}>{lang.nativeName}</Text>
                </Pressable>
              ))}
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
  speakerPanel: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
    backgroundColor: colors.background,
  },
  topPanel: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderStrong,
    backgroundColor: colors.backgroundSoft,
  },
  bottomPanel: {
    borderTopWidth: 0.5,
    borderTopColor: colors.borderStrong,
    paddingBottom: 130,
  },
  activePanelGlow: {
    backgroundColor: colors.surfaceSuccess,
  },
  rotatedContainer: {
    transform: [{ rotate: '180deg' }],
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  langSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...shadows.sm,
  },
  langSelectorText: {
    ...typography.captionMedium,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  controlIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallControlText: {
    ...typography.smallMedium,
    fontSize: 10,
    marginLeft: 4,
    color: colors.textSecondary,
  },
  instructionLabel: {
    ...typography.captionMedium,
    color: colors.textMuted,
  },
  transcriptScrollView: {
    flex: 1,
    marginVertical: spacing.sm,
  },
  transcriptScrollContent: {
    paddingVertical: spacing.xs,
  },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
    maxWidth: '90%',
    alignSelf: 'flex-start',
  },
  bubblePrimary: {
    borderLeftWidth: 4,
    borderLeftColor: colors.accentPurple,
  },
  bubbleSecondary: {
    borderLeftWidth: 4,
    borderLeftColor: colors.accentBlue,
  },
  bubbleRecording: {
    borderWidth: 1,
    borderColor: colors.accentPurple,
    backgroundColor: colors.surfaceWarning,
    width: '90%',
  },
  recordingLabel: {
    ...typography.smallMedium,
    color: colors.warning,
    marginBottom: 4,
  },
  streamingText: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
  },
  bubbleLang: {
    ...typography.smallMedium,
    fontSize: 9,
    color: colors.textSubtle,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  bubbleText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  bubbleDivider: {
    height: 0.5,
    backgroundColor: colors.borderStrong,
    marginVertical: 6,
  },
  bubbleLangTranslated: {
    ...typography.smallMedium,
    fontSize: 9,
    color: colors.primary,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  bubbleTextTranslated: {
    ...typography.bodySemibold,
    color: colors.primary,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    height: 60,
  },
  waveBar: {
    width: 4,
    marginHorizontal: 2,
    borderRadius: 2,
  },
  emptyTranscriptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyTranscriptText: {
    ...typography.body,
    color: colors.textSubtle,
    textAlign: 'center',
  },
  micRow: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  micButtonActive: {
    backgroundColor: colors.error,
    borderColor: colors.error,
    transform: [{ scale: 1.1 }],
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  centerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceSoft,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 4,
    height: 48,
  },
  centerBarLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  fallbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  fallbackBadgeText: {
    ...typography.smallMedium,
    fontSize: 9,
    color: colors.textSecondary,
  },
  vadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  vadLabel: {
    ...typography.smallMedium,
    fontSize: 10,
    color: colors.textSecondary,
    marginRight: 4,
  },
  centerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    ...shadows.sm,
  },
  finishBtnDisabled: {
    backgroundColor: colors.disabled,
  },
  finishBtnText: {
    ...typography.smallMedium,
    color: colors.textInverse,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: layout.cardRadius,
    borderTopRightRadius: layout.cardRadius,
    height: '60%',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.heading3,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  languagesList: {
    flex: 1,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderColor: colors.border,
  },
  languageItemText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  languageItemNative: {
    ...typography.caption,
    color: colors.textMuted,
  },
  processingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -85 }, { translateY: -25 }],
    width: 170,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  historyContainer: {
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  historyCard: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyCardBody: {
    flex: 1,
    marginRight: 12,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyCardMeta: {
    fontSize: 11,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted,
    flex: 1,
  },
  historyCardTime: {
    fontSize: 11,
    fontFamily: typography.captionMedium.fontFamily,
    color: colors.textSubtle,
  },
  historySourceText: {
    fontSize: 14,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
    marginBottom: 2,
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
  emptyHistoryText: {
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
    color: colors.textSubtle,
    textAlign: 'center',
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
});
