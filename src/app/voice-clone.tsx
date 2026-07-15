import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { RecordingPresets, AudioModule, useAudioPlayer } from 'expo-audio';
import { useAppAudioRecorder } from '../utils/audioRecorder';
import { generateUUID } from '../utils/uuid';
import { useCreateActivity, useActivityHistoryList, useDeleteActivity } from '../hooks/useActivityHistory';
import { historyService } from '../services/historyService';


import { colors } from '../constants/colors';
import { spacing, layout, shadows } from '../constants/spacing';
import { typography } from '../constants/typography';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { elevenLabsService } from '../services/elevenLabs';
import { TactileButton } from '../components';

const VoiceCloneNativeAudio: React.FC<{
  playingHistoryId: string | null;
  setPlayingHistoryId: (id: string | null) => void;
  playerRef: React.MutableRefObject<any>;
}> = ({ playingHistoryId, setPlayingHistoryId, playerRef }) => {
  const player = useAudioPlayer('');

  React.useEffect(() => {
    playerRef.current = player;
  }, [player]);

  React.useEffect(() => {
    if (playingHistoryId && player) {
      if (!player.playing && player.currentTime >= player.duration - 0.2) {
        setPlayingHistoryId(null);
      }
    }
  }, [player.playing, player.currentTime, playingHistoryId]);

  return null;
};

export default function VoiceCloneScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentRequestId, setCurrentRequestId] = useState(generateUUID());
  const [playingHistoryId, setPlayingHistoryId] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);

  const createActivityMutation = useCreateActivity();
  const deleteActivityMutation = useDeleteActivity();
  const { data: history = [], isLoading: loadingHistory } = useActivityHistoryList({ tool: 'voice_clone', limit: 5 });

  // Workflow steps: 'consent' | 'record' | 'processing' | 'ready'
  const [step, setStep] = useState<'consent' | 'record' | 'processing' | 'ready'>('consent');

  // Consent checklist
  const [consentOwnership, setConsentOwnership] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [volumeBar, setVolumeBar] = useState<number[]>([10, 10, 10, 10, 10]);

  // Voice details
  const [customVoiceName, setCustomVoiceName] = useState('My Custom Clone');
  const [selectedAccent, setSelectedAccent] = useState('US Accent');

  // Progress Pipeline
  const [cloningStatus, setCloningStatus] = useState('Uploading sample audio...');
  const [cloningProgress, setCloningProgress] = useState(0);

  // Timers
  const recordInterval = useRef<any>(null);
  const recordVolumeInterval = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recordInterval.current) clearInterval(recordInterval.current);
      if (recordVolumeInterval.current) clearInterval(recordVolumeInterval.current);
    };
  }, []);

  const [isRealConnected, setIsRealConnected] = useState(false);

  // Setup real recorder hook
  const recorder = useAppAudioRecorder();

  // Supabase Mutation
  const cloneVoiceMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      if (!recordedUri) throw new Error('No recorded sample audio');
      if (!consentOwnership || !consentPrivacy) {
        throw new Error('Legal consent required to clone voice');
      }

      console.log('Sending voice cloning request for name:', customVoiceName);
      const res = await elevenLabsService.cloneVoice(
        customVoiceName,
        recordedUri,
        selectedAccent,
        consentOwnership,
        consentPrivacy,
        recordDuration
      );

      if (res && res.voice_profile) {
        setIsRealConnected(true);
        return res.voice_profile;
      } else {
        throw new Error('Voice clone response was empty');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clonedVoices', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['usageEvents', user?.id] });
    },
  });

  const handleToggleRecord = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Sign in to use live voice cloning.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.replace('/(auth)/sign-in') }
        ]
      );
      return;
    }

    if (isRecording) {
      // Stop
      setIsRecording(false);
      if (recordInterval.current) clearInterval(recordInterval.current);
      if (recordVolumeInterval.current) clearInterval(recordVolumeInterval.current);
      setVolumeBar([10, 10, 10, 10, 10]);
      const completedUri = await recorder.stop();
      setRecordedUri(completedUri || recorder.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      // Start
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone Access', 'Microphone permissions are required for voice cloning.');
        return;
      }

      setIsRecording(true);
      setRecordDuration(0);
      setRecordedUri(null);
      setIsRealConnected(false);

      await recorder.record();

      recordInterval.current = setInterval(async () => {
        setRecordDuration(prev => {
          if (prev >= 30) {
            // A 30-second quick clone is supported; longer samples improve quality.
            handleStopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);

      recordVolumeInterval.current = setInterval(() => {
        setVolumeBar(Array.from({ length: 5 }, () => Math.floor(Math.random() * 35) + 10));
      }, 120);
    }
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    if (recordInterval.current) clearInterval(recordInterval.current);
    if (recordVolumeInterval.current) clearInterval(recordVolumeInterval.current);
    setVolumeBar([10, 10, 10, 10, 10]);
    const completedUri = await recorder.stop();
    setRecordedUri(completedUri || recorder.uri);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleStartCloneTraining = async () => {
    if (!recordedUri) return;
    if (recordDuration < 10) {
      Alert.alert('More Audio Needed', 'Record at least 10 seconds. A full 30 seconds produces a stronger quick clone.');
      return;
    }
    if (!consentOwnership || !consentPrivacy) {
      Alert.alert('Consent Required', 'Please confirm ownership and privacy terms.');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setStep('processing');
    setCloningProgress(10);
    setCloningStatus('Uploading sample audio...');

    try {
      // Step 2: Trigger API Call
      setCloningProgress(35);
      setCloningStatus('Phonetic print extraction...');
      
      const voiceProfile = await cloneVoiceMutation.mutateAsync();
      
      setCloningProgress(80);
      setCloningStatus('Registering custom voice model...');

      // Save to unified activity_history in Supabase
      if (user && voiceProfile) {
        const activity = await createActivityMutation.mutateAsync({
          client_request_id: currentRequestId,
          tool: 'voice_clone',
          operation_type: 'voice_clone',
          title: `Voice Clone: ${customVoiceName}`,
          source_text: `Accent: ${selectedAccent}`,
          duration_seconds: recordDuration || undefined,
          metadata: {
            voice_profile_id: voiceProfile.id,
            provider_voice_id: voiceProfile.provider_voice_id,
            display_name: voiceProfile.display_name,
            accent_info: voiceProfile.accent_info
          }
        });

        try {
          const sampleResponse = await fetch(recordedUri);
          const sampleBlob = await sampleResponse.blob();
          const samplePath = await historyService.uploadFile('voice_clone', activity.id, 'sample.m4a', sampleBlob, 'audio/mp4');

          await historyService.updateActivity(activity.id, {
            input_asset_path: samplePath,
          });
        } catch (uploadErr) {
          console.warn('Failed to archive voice clone sample to storage:', uploadErr);
        }
      }

      // Refresh request ID for next clone
      setCurrentRequestId(generateUUID());
      
      setCloningProgress(100);
      setCloningStatus('Voice clone ready!');
      setStep('ready');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Voice Cloning Failed', err.message || 'Error occurred while calling Edge Function.');
      setStep('record');
    }
  };

  const handleSelectAccent = () => {
    Alert.alert(
      'Voice Accent Tag',
      'Select matching accent for search optimization.',
      [
        { text: 'US Accent', onPress: () => setSelectedAccent('US Accent') },
        { text: 'UK Accent', onPress: () => setSelectedAccent('UK Accent') },
        { text: 'Australian', onPress: () => setSelectedAccent('Australian') },
        { text: 'Spanish Accent', onPress: () => setSelectedAccent('Spanish Accent') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const selectConsentText = (type: 'ownership' | 'privacy') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === 'ownership') {
      setConsentOwnership(!consentOwnership);
    } else {
      setConsentPrivacy(!consentPrivacy);
    }
  };

  const handleSelectHistoryItem = (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('ready');
    setCustomVoiceName(item.title?.replace('Voice Clone: ', '') || 'My Voice');
    setSelectedAccent(item.source_text?.replace('Accent: ', '') || 'US Accent');
  };

  const handleDeleteHistoryItem = (itemId: string) => {
    Alert.alert(
      'Delete History Item',
      'Are you sure you want to delete this voice clone from your history?',
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

  const handleExportHistoryItem = async (item: any, mode: 'text' | 'audio' = 'text') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await historyService.exportActivity(item, mode);
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export voice clone.');
    }
  };

  const handlePlayHistoryAudio = async (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playingHistoryId === item.id) {
      if (Platform.OS === 'web') {
        if (webAudioRef.current) webAudioRef.current.pause();
      } else if (playerRef.current) {
        playerRef.current.pause();
      }
      setPlayingHistoryId(null);
      return;
    }
    if (!item.input_asset_path) {
      Alert.alert('Audio Unavailable', 'No audio sample is stored for this item.');
      return;
    }
    try {
      const url = await historyService.getSignedUrl(item.input_asset_path);
      if (url) {
        setPlayingHistoryId(item.id);
        if (Platform.OS === 'web') {
          if (webAudioRef.current) webAudioRef.current.pause();
          webAudioRef.current = new Audio(url);
          webAudioRef.current.onended = () => setPlayingHistoryId(null);
          webAudioRef.current.play().catch((e) => console.warn(e));
        } else if (playerRef.current) {
          playerRef.current.replace({ uri: url });
          playerRef.current.play();
        }
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Playback Error', 'Failed to play sample audio.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Instant Voice Cloning</Text>
        <View style={styles.spacerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        


        {/* STEP 1: CONSENT */}
        {step === 'consent' && (
          <View style={styles.cardContainer}>
            <View style={styles.stepHeader}>
              <View style={styles.badge}><Text style={styles.badgeText}>STEP 1 OF 3</Text></View>
              <Text style={styles.stepTitle}>Biometric Legal Agreement</Text>
            </View>
            <Text style={styles.stepSubtitle}>
              Voice cloning requires legal authorization. Please read and accept the terms of ownership.
            </Text>

            <View style={styles.termsBox}>
              <ScrollView nestedScrollEnabled={false} style={{ maxHeight: 200 }}>
                <Text style={styles.termsText}>
                  By consenting below, you grant YSnap permission to process a digital audio recording of your voice. This biometric data is parsed solely by ElevenLabs API protocols to create a synthetic voice replication. YSnap does not rent, sell, or monetize voice prints. The voice model remains associated exclusively with your secure account.
                </Text>
              </ScrollView>
            </View>

            {/* Checkbox 1 */}
            <Pressable 
              style={styles.checkboxRow} 
              onPress={() => selectConsentText('ownership')}
            >
              <Ionicons 
                name={consentOwnership ? "checkbox" : "square-outline"} 
                size={22} 
                color={consentOwnership ? colors.primary : colors.textMuted} 
                style={{ marginRight: 12 }}
              />
              <Text style={styles.checkboxText}>
                I confirm I am recording my own voice. I will not clone voices of other individuals without explicit permission.
              </Text>
            </Pressable>

            {/* Checkbox 2 */}
            <Pressable 
              style={styles.checkboxRow} 
              onPress={() => selectConsentText('privacy')}
            >
              <Ionicons 
                name={consentPrivacy ? "checkbox" : "square-outline"} 
                size={22} 
                color={consentPrivacy ? colors.primary : colors.textMuted} 
                style={{ marginRight: 12 }}
              />
              <Text style={styles.checkboxText}>
                I acknowledge the data privacy agreements. I authorize secure processing of my bio-audio characteristics.
              </Text>
            </Pressable>

            <TactileButton
              title="Accept & Continue"
              disabled={!consentOwnership || !consentPrivacy}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setStep('record');
              }}
              icon={<Ionicons name="arrow-forward" size={18} color={colors.textInverse} />}
              iconPosition="right"
            />
          </View>
        )}

        {/* STEP 2: RECORD */}
        {step === 'record' && (
          <View style={styles.cardContainer}>
            <View style={styles.stepHeader}>
              <View style={styles.badge}><Text style={styles.badgeText}>STEP 2 OF 3</Text></View>
              <Text style={styles.stepTitle}>Record Speech Sample</Text>
            </View>
            <Text style={styles.stepSubtitle}>
              Record 10–30 seconds in a quiet room. Thirty seconds is better for a quick clone; ElevenLabs recommends 1–2 minutes for highest reliability.
            </Text>

            {/* Custom Voice Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Voice Profile Name</Text>
              <TextInput
                style={styles.textInput}
                value={customVoiceName}
                onChangeText={setCustomVoiceName}
                placeholder="Enter voice clone name (e.g. My Voice)"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Script Display */}
            <View style={styles.scriptBox}>
              <Text style={styles.scriptLabel}>Guided Reading Script:</Text>
              <Text style={styles.scriptText}>
                "The quick brown fox jumps over the lazy dog. Recording custom voice profiles enables advanced text-to-speech translations. I authorize the secure capture of my biometric speech characteristics."
              </Text>
            </View>

            {/* Settings Row */}
            <View style={styles.optionRow}>
              <Pressable style={styles.accentBadge} onPress={handleSelectAccent}>
                <Text style={styles.accentBadgeText}>{selectedAccent}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.textPrimary} style={{ marginLeft: 4 }} />
              </Pressable>
            </View>

            {/* Status Display */}
            {isRecording ? (
              <View style={styles.recordStatusCol}>
                <Text style={styles.countdownText}>Recording: {recordDuration} / 30s</Text>
                <View style={styles.waveRow}>
                  {volumeBar.map((vol, i) => (
                    <View key={i} style={[styles.waveBar, { height: vol, backgroundColor: colors.error }]} />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.recordStatusCol}>
                <Text style={styles.countdownText}>
                  {recordedUri ? 'Sample Recorded Successfully!' : 'Ready to record'}
                </Text>
              </View>
            )}

            {/* Recording Controls */}
            <View style={styles.micControlRow}>
              <Pressable
                style={[styles.micBtn, isRecording && styles.micBtnActive]}
                onPress={handleToggleRecord}
              >
                <Ionicons 
                  name={isRecording ? 'stop' : 'mic'} 
                  size={36} 
                  color={colors.textInverse} 
                />
              </Pressable>
            </View>

            {recordedUri && !isRecording && (
              <View style={styles.bottomActionsCol}>
                <TactileButton
                  title="Begin Voice Training"
                  variant="primary"
                  onPress={handleStartCloneTraining}
                  disabled={recordDuration < 10}
                  icon={<Ionicons name="sparkles" size={18} color={colors.textInverse} />}
                  iconPosition="right"
                />
              </View>
            )}
          </View>
        )}

        {/* STEP 3: PROCESSING PIPELINE */}
        {step === 'processing' && (
          <View style={styles.cardContainer}>
            <View style={styles.stepHeader}>
              <View style={styles.badge}><Text style={styles.badgeText}>STEP 3 OF 3</Text></View>
              <Text style={styles.stepTitle}>Accent Model Training</Text>
            </View>
            
            <View style={styles.pipelineContainer}>
              <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 20 }} />
              
              <Text style={styles.pipelineStatusText}>{cloningStatus}</Text>
              <Text style={styles.pipelinePercentText}>{cloningProgress}% Complete</Text>

              {/* Custom Pipeline Progress Bar */}
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${cloningProgress}%`, backgroundColor: colors.accentPurple }]} />
              </View>

              <View style={styles.pipelineDetails}>
                <View style={styles.pipelineRow}>
                  <Ionicons name={cloningProgress >= 10 ? "checkmark-circle" : "ellipse-outline"} size={16} color={cloningProgress >= 10 ? colors.success : colors.textSubtle} />
                  <Text style={styles.pipelineRowText}>Upload audio chunk</Text>
                </View>
                <View style={styles.pipelineRow}>
                  <Ionicons name={cloningProgress >= 35 ? "checkmark-circle" : "ellipse-outline"} size={16} color={cloningProgress >= 35 ? colors.success : colors.textSubtle} />
                  <Text style={styles.pipelineRowText}>Phonetic signature check</Text>
                </View>
                <View style={styles.pipelineRow}>
                  <Ionicons name={cloningProgress >= 65 ? "checkmark-circle" : "ellipse-outline"} size={16} color={cloningProgress >= 65 ? colors.success : colors.textSubtle} />
                  <Text style={styles.pipelineRowText}>Accent profiles sync</Text>
                </View>
                <View style={styles.pipelineRow}>
                  <Ionicons name={cloningProgress >= 100 ? "checkmark-circle" : "ellipse-outline"} size={16} color={cloningProgress >= 100 ? colors.success : colors.textSubtle} />
                  <Text style={styles.pipelineRowText}>Neural weights synthesize</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* STEP 4: COMPLETED PIPELINE */}
        {step === 'ready' && (
          <View style={styles.cardContainer}>
            <View style={styles.successWrapper}>
              <View style={styles.successIconBox}>
                <Ionicons name="checkmark-done-circle" size={64} color={colors.success} />
              </View>
              <Text style={styles.successTitle}>Custom Voice Ready!</Text>
              <Text style={styles.successSubtitle}>
                Your clone '{customVoiceName}' has been compiled and synchronized with Supabase database. You can select this voice as your playback voice inside Settings page.
              </Text>

              <Pressable
                style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.replace('/voice-library')}
              >
                <Text style={styles.primaryActionBtnText}>Return to Voice Library</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.textInverse} style={{ marginLeft: 8 }} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Unified Tool History */}
        <View style={styles.historyContainer}>
          <Text style={styles.sectionTitle}>Recent History</Text>
          {loadingHistory ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : history && history.length > 0 ? (
            history.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <Pressable style={styles.historyCardBody} onPress={() => handleSelectHistoryItem(item)}>
                  <View style={styles.historyCardHeader}>
                    <Text style={styles.historyCardMeta}>
                      {item.title}
                    </Text>
                    <Text style={styles.historyCardTime}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                    </Text>
                  </View>
                  <Text style={styles.historySourceText} numberOfLines={2}>
                    {item.source_text}
                  </Text>
                </Pressable>
                <View style={styles.historyCardActions}>
                  <Pressable style={styles.historyActionBtn} onPress={() => handlePlayHistoryAudio(item)}>
                    <Ionicons 
                      name={playingHistoryId === item.id ? 'pause-outline' : 'play-outline'} 
                      size={16} 
                      color={playingHistoryId === item.id ? colors.accentPurple : colors.textSecondary} 
                    />
                  </Pressable>
                  <Pressable style={styles.historyActionBtn} onPress={() => handleExportHistoryItem(item, 'text')}>
                    <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable style={styles.historyActionBtn} onPress={() => handleDeleteHistoryItem(item.id)}>
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyHistoryText}>No voice clone history yet. Consent and record a sample to clone your voice.</Text>
          )}
        </View>
      </ScrollView>
      {Platform.OS !== 'web' && (
        <VoiceCloneNativeAudio
          playingHistoryId={playingHistoryId}
          setPlayingHistoryId={setPlayingHistoryId}
          playerRef={playerRef}
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...typography.heading3,
    color: colors.textPrimary,
  },
  spacerBtn: {
    width: layout.touchTarget,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    ...shadows.md,
  },
  stepHeader: {
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  badgeText: {
    ...typography.smallMedium,
    color: colors.textInverse,
    fontSize: 9,
    fontWeight: '700',
  },
  stepTitle: {
    ...typography.heading2,
    color: colors.textPrimary,
  },
  stepSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  termsBox: {
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  termsText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
  },
  checkboxText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    height: layout.buttonHeight,
    borderRadius: layout.buttonRadius,
    marginTop: 20,
    ...shadows.md,
  },
  primaryActionBtnDisabled: {
    backgroundColor: colors.disabled,
  },
  primaryActionBtnText: {
    ...typography.button,
    color: colors.textInverse,
  },
  scriptBox: {
    backgroundColor: colors.surfaceWarning,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  scriptLabel: {
    ...typography.captionMedium,
    color: colors.warning,
    fontWeight: '700',
    marginBottom: 6,
  },
  scriptText: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  optionRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  accentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  accentBadgeText: {
    ...typography.captionMedium,
    color: colors.textPrimary,
  },
  recordStatusCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 10,
  },
  countdownText: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
  },
  waveBar: {
    width: 6,
    marginHorizontal: 3,
    borderRadius: 3,
  },
  micControlRow: {
    alignItems: 'center',
    marginVertical: 14,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  micBtnActive: {
    backgroundColor: colors.error,
    transform: [{ scale: 1.1 }],
  },
  bottomActionsCol: {
    marginTop: 10,
  },
  pipelineContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pipelineStatusText: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  pipelinePercentText: {
    ...typography.smallMedium,
    color: colors.accentPurple,
    marginBottom: 16,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 24,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  pipelineDetails: {
    width: '100%',
    borderTopWidth: 0.5,
    borderColor: colors.border,
    paddingTop: 16,
  },
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  pipelineRowText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  successWrapper: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIconBox: {
    marginBottom: 16,
  },
  successTitle: {
    ...typography.heading2,
    color: colors.success,
    marginBottom: 8,
  },
  successSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundSoft,
  },
  historyContainer: {
    marginTop: 30,
    marginBottom: 20,
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
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: typography.captionMedium.fontWeight,
    color: colors.accentPurple,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
});
