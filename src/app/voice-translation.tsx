import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, Alert, TextInput, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { getLanguageByCode, languages } from '../constants/languages';
import { Ionicons } from '@expo/vector-icons';
import { AudioModule, useAudioPlayer, RecordingPresets } from 'expo-audio';
import { useAppAudioRecorder, useAppAudioRecorderState } from '../utils/audioRecorder';
import { MotionScreen } from '../components/MotionScreen';
import { elevenLabsService } from '../services/elevenLabs';
import { callEdgeFunction } from '../lib/supabase';
import { ReactiveVoiceOrb } from '../components';
import { generateUUID } from '../utils/uuid';
import { useCreateActivity, useActivityHistoryList, useDeleteActivity } from '../hooks/useActivityHistory';
import { historyService } from '../services/historyService';

const VoiceTranslationNativeAudio: React.FC<{
  outputAudioUrl: string | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playingHistoryId: string | null;
  setPlayingHistoryId: (id: string | null) => void;
  playerRef: React.MutableRefObject<any>;
}> = ({ outputAudioUrl, isPlaying, setIsPlaying, playingHistoryId, setPlayingHistoryId, playerRef }) => {
  const player = useAudioPlayer(outputAudioUrl || '');

  React.useEffect(() => {
    playerRef.current = player;
  }, [player]);

  React.useEffect(() => {
    if (isPlaying && player) {
      if (!player.playing && player.currentTime >= player.duration - 0.2) {
        setIsPlaying(false);
      }
    }
  }, [player.playing, player.currentTime, isPlaying]);

  React.useEffect(() => {
    if (playingHistoryId && player) {
      if (!player.playing && player.currentTime >= player.duration - 0.2) {
        setPlayingHistoryId(null);
      }
    }
  }, [player.playing, player.currentTime, playingHistoryId]);

  return null;
};

export default function VoiceTranslationScreen() {
  const recorder = useAppAudioRecorder({
    isMeteringEnabled: true,
  });
  const recorderState = useAppAudioRecorderState(recorder, 100);

  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentRequestId, setCurrentRequestId] = useState(generateUUID());
  const [playingHistoryId, setPlayingHistoryId] = useState<string | null>(null);

  const createActivityMutation = useCreateActivity();
  const deleteActivityMutation = useDeleteActivity();
  const { data: history = [], isLoading: loadingHistory } = useActivityHistoryList({ tool: 'voice', limit: 5 });

  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [statusText, setStatusText] = useState('Ready to record');
  
  // Waveform heights state (15 bars)
  const [waveform, setWaveform] = useState<number[]>([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  
  // Audio result states
  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [translationItemId, setTranslationItemId] = useState<string | null>(null);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [selectedSourceLanguage, setSelectedSourceLanguage] = useState<string | null>(null);
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState<string | null>(null);
  const [languagePicker, setLanguagePicker] = useState<'source' | 'target' | null>(null);

  // Audio Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0 to 100
  const [outputAudioUrl, setOutputAudioUrl] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);

  const timerRef = useRef<any>(null);
  const waveRef = useRef<any>(null);
  const playbackRef = useRef<any>(null);

  // Fetch languages
  const { data: profile } = useQuery<any>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: preferences } = useQuery<any>({
    queryKey: ['preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_preferences')
        .select('selected_voice_id')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const nativeCode = selectedSourceLanguage ?? profile?.native_language ?? 'en';
  const targetCode = selectedTargetLanguage ?? profile?.primary_target_language ?? 'es';
  const isBusy = isRecording || statusText === 'Processing audio...' ||
    statusText === 'Transcribing and translating...' || statusText === 'Re-translating...' ||
    statusText === 'Generating voice...' || statusText === 'Saving history...';

  const resetTranslationResult = () => {
    if (Platform.OS === 'web') {
      if (webAudioRef.current) webAudioRef.current.pause();
    } else if (playerRef.current) {
      playerRef.current.pause();
    }
    setIsPlaying(false);
    setOutputAudioUrl(null);
    setPlaybackProgress(0);
    setTranscription('');
    setTranslation('');
    setEditedText('');
    setSessionId(null);
    setTranslationItemId(null);
    setStatusText('Ready to record');
  };

  const chooseLanguage = (code: string) => {
    Haptics.selectionAsync();
    if (languagePicker === 'source') {
      if (code === targetCode) setSelectedTargetLanguage(nativeCode);
      setSelectedSourceLanguage(code);
    } else if (languagePicker === 'target') {
      if (code === nativeCode) setSelectedSourceLanguage(targetCode);
      setSelectedTargetLanguage(code);
    }
    setLanguagePicker(null);
    resetTranslationResult();
  };

  const swapLanguages = () => {
    if (isBusy) return;
    Haptics.selectionAsync();
    setSelectedSourceLanguage(targetCode);
    setSelectedTargetLanguage(nativeCode);
    resetTranslationResult();
  };

  // Timer tick
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordTime((t) => t + 1);
      }, 1000);
      
      waveRef.current = setInterval(() => {
        // Random premium-looking voice heights
        setWaveform(Array.from({ length: 15 }, () => Math.floor(Math.random() * 50) + 12));
      }, 120);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveRef.current) clearInterval(waveRef.current);
      setWaveform([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
      setRecordTime(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveRef.current) clearInterval(waveRef.current);
    };
  }, [isRecording]);

  // Sync timeline progress with real audio duration
  useEffect(() => {
    let progressTimer: any;
    if (Platform.OS !== 'web' && isPlaying && playerRef.current && playerRef.current.duration > 0) {
      progressTimer = setInterval(() => {
        const currentProgress = (playerRef.current.currentTime / playerRef.current.duration) * 100;
        setPlaybackProgress(Math.min(100, currentProgress));
      }, 50);
    }
    return () => clearInterval(progressTimer);
  }, [isPlaying, playerRef.current?.currentTime, playerRef.current?.duration]);

  // Handle playback completion
  useEffect(() => {
    if (Platform.OS !== 'web' && isPlaying && playerRef.current && !playerRef.current.playing && playerRef.current.currentTime >= playerRef.current.duration - 0.2) {
      setIsPlaying(false);
      setPlaybackProgress(100);
      setTimeout(() => setPlaybackProgress(0), 200);
      setStatusText('Translation ready');
    }
  }, [playerRef.current?.playing, playerRef.current?.currentTime]);

  const handleStartRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Sign in to use live voice translation.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.replace('/(auth)/sign-in') }
        ]
      );
      return;
    }
    
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Microphone Access', 'Microphone permissions are required for voice translation.');
        return;
      }

      setTranscription('');
      setTranslation('');
      setIsRecording(true);
      setStatusText('Listening...');
      await recorder.record();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRecording(false);
    setStatusText('Processing audio...');

    try {
      const completedUri = await recorder.stop();
      const audioUri = completedUri || recorder.uri;
      if (!audioUri) {
        throw new Error('No recorded audio file found.');
      }

      // One authenticated server call handles STT, translation, cloned/preset TTS,
      // private audio storage, and the history records as one logical turn.
      setStatusText('Transcribing and translating...');
      const result = await elevenLabsService.translateVoice(audioUri, {
        sourceLanguage: nativeCode,
        targetLanguage: targetCode,
        voiceId: preferences?.selected_voice_id || '21m00Tcm4TlvDq8ikWAM',
        sessionType: 'voice',
        sessionId: sessionId || undefined,
      });

      const sourceText = result.source_text;
      const translatedText = result.translated_text;
      setSessionId(result.session_id);
      setTranslationItemId(result.translation_item_id);
      setTranscription(sourceText);
      setEditedText(sourceText);
      setTranslation(translatedText);

      if (result.generated_audio_url) {
        setOutputAudioUrl(result.generated_audio_url);
        if (Platform.OS === 'web') {
          if (webAudioRef.current) webAudioRef.current.pause();
          webAudioRef.current = new Audio(result.generated_audio_url);
          webAudioRef.current.addEventListener('timeupdate', () => {
            if (webAudioRef.current && webAudioRef.current.duration > 0) {
              const currentProgress = (webAudioRef.current.currentTime / webAudioRef.current.duration) * 100;
              setPlaybackProgress(Math.min(100, currentProgress));
            }
          });
          webAudioRef.current.onended = () => {
            setIsPlaying(false);
            setPlaybackProgress(0);
          };
          webAudioRef.current.play().catch((e) => console.warn('[Web Audio] failed:', e));
        } else if (playerRef.current) {
          playerRef.current.replace({ uri: result.generated_audio_url });
          playerRef.current.play();
        }
        setIsPlaying(true);
        setPlaybackProgress(0);
        setStatusText('Translation ready');
      } else {
        throw new Error('Failed to generate speech output.');
      }

      // Save to unified activity_history in Supabase
      if (user) {
        setStatusText('Saving history...');
        const activity = await createActivityMutation.mutateAsync({
          client_request_id: currentRequestId,
          tool: 'voice',
          operation_type: 'voice_translation',
          title: sourceText.slice(0, 80),
          source_language: nativeCode,
          target_language: targetCode,
          source_text: sourceText,
          translated_text: translatedText,
          duration_seconds: recordTime || undefined,
          metadata: {
            session_id: result.session_id,
            translation_item_id: result.translation_item_id
          }
        });

        try {
          const inputResponse = await fetch(audioUri);
          const inputBlob = await inputResponse.blob();
          const inputPath = await historyService.uploadFile('voice', activity.id, 'input.m4a', inputBlob, 'audio/mp4');

          let outputPath = '';
          if (result.generated_audio_url) {
            const outputResponse = await fetch(result.generated_audio_url);
            const outputBlob = await outputResponse.blob();
            outputPath = await historyService.uploadFile('voice', activity.id, 'output.mp3', outputBlob, 'audio/mpeg');
          }

          await historyService.updateActivity(activity.id, {
            input_asset_path: inputPath,
            output_asset_path: outputPath || undefined,
          });
        } catch (uploadErr) {
          console.warn('Failed to upload audio assets to history-files storage:', uploadErr);
        }
      }

      setCurrentRequestId(generateUUID());
      queryClient.invalidateQueries({ queryKey: ['recentSessions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['historySessions', user?.id] });
    } catch (e: any) {
      console.error(e);
      setStatusText('Error occurred');
      Alert.alert('Translation Error', e.message || 'An unexpected error occurred during translation.');
    }
  };

  const handleTogglePlayback = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      if (Platform.OS === 'web') {
        if (webAudioRef.current) webAudioRef.current.pause();
      } else if (playerRef.current) {
        playerRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    if (!translation) return;

    try {
      setIsPlaying(true);
      let audioUrl = outputAudioUrl;
      if (!audioUrl) {
        setStatusText('Generating pronunciation...');
        const targetVoiceId = preferences?.selected_voice_id || '21m00Tcm4TlvDq8ikWAM';
        const res = await elevenLabsService.generateSpeech(translation, targetVoiceId, true);
        if (res && res.url) {
          audioUrl = res.url;
          setOutputAudioUrl(res.url);
        } else {
          throw new Error('TTS synthesis returned empty URL');
        }
      }
      setStatusText('Playing pronunciation...');
      if (Platform.OS === 'web') {
        if (webAudioRef.current) webAudioRef.current.pause();
        webAudioRef.current = new Audio(audioUrl);
        webAudioRef.current.addEventListener('timeupdate', () => {
          if (webAudioRef.current && webAudioRef.current.duration > 0) {
            const currentProgress = (webAudioRef.current.currentTime / webAudioRef.current.duration) * 100;
            setPlaybackProgress(Math.min(100, currentProgress));
          }
        });
        webAudioRef.current.onended = () => {
          setIsPlaying(false);
          setPlaybackProgress(0);
        };
        webAudioRef.current.play().catch((e) => console.warn('[Web Audio] failed:', e));
      } else if (playerRef.current) {
        playerRef.current.replace({ uri: audioUrl });
        playerRef.current.play();
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('TTS Playback Failed', err.message || 'Error occurred while calling Edge Function.');
      setIsPlaying(false);
      setStatusText('Translation ready');
    }
  };

  const cycleSpeed = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const speeds = [0.8, 1.0, 1.2, 1.5];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
  };

  const saveEditedTranscript = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTranscription(editedText);
    setIsEditingTranscript(false);
    setStatusText('Re-translating...');

    try {
      const { data: translationResult, error: transError } = await callEdgeFunction<{
        translated_text: string;
        detected_language: string;
      }>('translate-text', {
        source: nativeCode,
        target: targetCode,
        text: editedText,
      });

      if (transError || !translationResult) {
        throw transError || new Error('Failed to translate text.');
      }

      const translatedText = translationResult.translated_text;
      setTranslation(translatedText);
      setStatusText('Translation updated');

      // Re-generate speech output
      setStatusText('Generating voice...');
      const ttsResult = await elevenLabsService.generateSpeech(
        translatedText,
        preferences?.selected_voice_id || '21m00Tcm4TlvDq8ikWAM',
        true,
        sessionId || undefined,
      );
      if (ttsResult && ttsResult.url) {
        setOutputAudioUrl(ttsResult.url);
        if (Platform.OS === 'web') {
          if (webAudioRef.current) webAudioRef.current.pause();
          webAudioRef.current = new Audio(ttsResult.url);
          webAudioRef.current.addEventListener('timeupdate', () => {
            if (webAudioRef.current && webAudioRef.current.duration > 0) {
              const currentProgress = (webAudioRef.current.currentTime / webAudioRef.current.duration) * 100;
              setPlaybackProgress(Math.min(100, currentProgress));
            }
          });
          webAudioRef.current.onended = () => {
            setIsPlaying(false);
            setPlaybackProgress(0);
          };
          webAudioRef.current.play().catch((e) => console.warn(e));
        } else if (playerRef.current) {
          playerRef.current.replace({ uri: ttsResult.url });
          playerRef.current.play();
        }
        setIsPlaying(true);
        setPlaybackProgress(0);
        setStatusText('Translation ready');
      } else {
        throw new Error('Failed to generate speech output.');
      }

      if (translationItemId) {
        const { error: updateError } = await (supabase as any)
          .from('translation_items')
          .update({
            source_text: editedText,
            translated_text: translatedText,
            generated_audio_path: ttsResult.filePath,
          } as any)
          .eq('id', translationItemId)
          .eq('user_id', user?.id || '');
        if (updateError) throw updateError;
      }
    } catch (e: any) {
      console.error(e);
      setStatusText('Error occurred');
      Alert.alert('Translation Error', e.message || 'An unexpected error occurred.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectHistoryItem = (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTranscription(item.source_text || '');
    setEditedText(item.source_text || '');
    setTranslation(item.translated_text || '');
    setSessionId(item.metadata?.session_id || null);
    setTranslationItemId(item.metadata?.translation_item_id || null);
    if (item.output_asset_path) {
      historyService.getSignedUrl(item.output_asset_path).then((url) => {
        if (url) {
          setOutputAudioUrl(url);
          if (Platform.OS !== 'web' && playerRef.current) {
            playerRef.current.replace({ uri: url });
          }
        }
      });
    } else {
      setOutputAudioUrl(null);
    }
  };

  const handleDeleteHistoryItem = (itemId: string) => {
    Alert.alert(
      'Delete History Item',
      'Are you sure you want to delete this recording from your history?',
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
      Alert.alert('Export Error', err.message || 'Failed to export voice translation.');
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
    if (!item.output_asset_path) {
      Alert.alert('Audio Unavailable', 'No audio playback is stored for this item.');
      return;
    }
    try {
      const url = await historyService.getSignedUrl(item.output_asset_path);
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
      Alert.alert('Playback Error', 'Failed to play history audio.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Voice Translator</Text>
        <View style={{ width: 24 }} />
      </View>

      <MotionScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Language pairing banner */}
        <View style={styles.languageBanner}>
          <Pressable
            style={styles.languageChoice}
            disabled={isBusy}
            onPress={() => setLanguagePicker('source')}
          >
            <Text style={styles.languageChoiceLabel}>FROM</Text>
            <View style={styles.languageChoiceRow}>
              <Text style={styles.langTag}>{getLanguageByCode(nativeCode)?.name}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel="Swap translation languages"
            style={[styles.swapButton, isBusy && styles.disabledControl]}
            disabled={isBusy}
            onPress={swapLanguages}
          >
            <Ionicons name="swap-horizontal" size={18} color={colors.accentPurple} />
          </Pressable>
          <Pressable
            style={styles.languageChoice}
            disabled={isBusy}
            onPress={() => setLanguagePicker('target')}
          >
            <Text style={styles.languageChoiceLabel}>TO</Text>
            <View style={styles.languageChoiceRow}>
              <Text style={[styles.langTag, { color: colors.accentPurple }]}>{getLanguageByCode(targetCode)?.name}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.accentPurple} />
            </View>
          </Pressable>
        </View>

        {/* Audio Waveform and Timer Box */}
        <View style={styles.visualizerBox}>
          {isRecording ? (
            <Text style={styles.timer}>{formatTime(recordTime)}</Text>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statusLabel}>{statusText}</Text>
              {isBusy && !isRecording && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: -8, marginBottom: 12 }} />
              )}
            </View>
          )}

          {/* Waveform graphic */}
          <View style={styles.waveformContainer}>
            {waveform.map((h, i) => (
              <View 
                key={i} 
                style={[
                  styles.waveBar, 
                  { height: h },
                  isRecording && { backgroundColor: colors.primary }
                ]} 
              />
            ))}
          </View>
        </View>

        {/* Action button orb */}
        <View style={styles.orbSection}>
          <ReactiveVoiceOrb
            isRecording={isRecording}
            metering={recorderState?.metering}
            isPlaying={isPlaying}
            isProcessing={isBusy && !isRecording}
            onPress={() => {
              if (isRecording) {
                handleStopRecording();
              } else if (!isBusy) {
                handleStartRecording();
              }
            }}
          />
          <Text style={styles.orbLabel}>
            {isRecording ? 'Tap to finish speaking' : 'Tap to start speaking'}
          </Text>
        </View>

        {/* Translation Output Cards */}
        {(transcription !== '' || translation !== '') && (
          <View style={styles.resultGroup}>
            
            {/* Source text transcription */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderTitle}>TRANSCRIPT</Text>
                <Pressable 
                  style={styles.editLink}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsEditingTranscript(true);
                  }}
                >
                  <Ionicons name="create-outline" size={14} color={colors.accentPurple} style={{ marginRight: 4 }} />
                  <Text style={styles.editLinkText}>Edit</Text>
                </Pressable>
              </View>
              <Text style={styles.transText}>{transcription || 'Transcribing...'}</Text>
            </View>

            {/* Translation card */}
            <View style={[styles.card, styles.translationCard]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardHeaderTitle, { color: colors.textMuted }]}>TRANSLATION</Text>
              </View>
              <Text style={[styles.transText, { color: colors.textPrimary }]}>
                {translation || 'Translating...'}
              </Text>
              
              {/* Playback Controls widget */}
              {translation !== '' && (
                <View style={styles.playbackContainer}>
                  {/* Play scrubber */}
                  <View style={styles.scrubberRow}>
                    <Pressable style={styles.playButton} onPress={handleTogglePlayback}>
                      <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={colors.textInverse} />
                    </Pressable>
                    <View style={styles.scrubberTrack}>
                      <View style={[styles.scrubberFill, { width: `${playbackProgress}%` }]} />
                    </View>
                    <Pressable style={styles.speedButton} onPress={cycleSpeed}>
                      <Text style={styles.speedText}>{playbackSpeed.toFixed(1)}x</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Unified Tool History */}
        <View style={styles.historyContainer}>
          <Text style={styles.sectionHeader}>Recent History</Text>
          {loadingHistory ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : history && history.length > 0 ? (
            history.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <Pressable style={styles.historyCardBody} onPress={() => handleSelectHistoryItem(item)}>
                  <View style={styles.historyCardHeader}>
                    <Text style={styles.historyCardMeta}>
                      {item.source_language?.toUpperCase()} → {item.target_language?.toUpperCase()}
                    </Text>
                    <Text style={styles.historyCardTime}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                    </Text>
                  </View>
                  <Text style={styles.historySourceText} numberOfLines={2}>{item.source_text}</Text>
                  <Text style={styles.historyTranslatedText} numberOfLines={2}>{item.translated_text}</Text>
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
            <Text style={styles.emptyHistoryText}>No voice recordings yet. Tap the microphone to speak.</Text>
          )}
        </View>
      </ScrollView>
      </MotionScreen>

      {/* Transcript Edit Modal */}
      <Modal
        visible={isEditingTranscript}
        animationType="fade"
        transparent
        onRequestClose={() => setIsEditingTranscript(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeading}>Edit Transcript</Text>
            <TextInput
              style={styles.modalInput}
              multiline
              value={editedText}
              onChangeText={setEditedText}
            />
            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalBtn, styles.modalBtnCancel]} 
                onPress={() => setIsEditingTranscript(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalBtn, styles.modalBtnSave]} 
                onPress={saveEditedTranscript}
              >
                <Text style={styles.modalBtnSaveText}>Translate</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={languagePicker !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setLanguagePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.languageModalContent]}>
            <View style={styles.languageModalHeader}>
              <View>
                <Text style={styles.modalHeading}>
                  {languagePicker === 'source' ? 'Choose source language' : 'Choose target language'}
                </Text>
                <Text style={styles.languageModalSubtitle}>Select any supported translation language</Text>
              </View>
              <Pressable onPress={() => setLanguagePicker(null)} style={styles.languageCloseButton}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
              {languages.map((language) => {
                const isSelected = (languagePicker === 'source' ? nativeCode : targetCode) === language.code;
                return (
                  <Pressable
                    key={language.code}
                    style={[styles.languageListItem, isSelected && styles.languageListItemSelected]}
                    onPress={() => chooseLanguage(language.code)}
                  >
                    <View>
                      <Text style={styles.languageListName}>{language.name}</Text>
                      <Text style={styles.languageListNative}>{language.nativeName}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accentPurple} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {Platform.OS !== 'web' && (
        <VoiceTranslationNativeAudio
          outputAudioUrl={outputAudioUrl}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
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
  scrollContent: {
    padding: 24,
  },
  languageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSoft,
    borderWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  langTag: {
    fontSize: 14,
    fontFamily: typography.bodySemibold.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  languageChoice: {
    flex: 1,
    paddingHorizontal: 6,
  },
  languageChoiceLabel: {
    fontSize: 9,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.1,
    marginBottom: 3,
  },
  languageChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swapButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  disabledControl: {
    opacity: 0.4,
  },
  visualizerBox: {
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: 20,
    borderWidth: 0,
    padding: 24,
    marginBottom: 28,
  },
  timer: {
    fontSize: 32,
    fontFamily: typography.tabular.fontFamily,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 15,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  waveformContainer: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    gap: 4,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    minHeight: 6,
  },
  orbSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  recordingOrbIdle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  recordingOrbActive: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 12,
  },
  stopIcon: {
    width: 24,
    height: 24,
    backgroundColor: colors.textInverse,
    borderRadius: 4,
  },
  orbLabel: {
    fontSize: 14,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textMuted,
  },
  resultGroup: {
    gap: 16,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 0,
    padding: 16,
  },
  translationCard: {
    backgroundColor: colors.surfaceSuccess,
    borderColor: colors.successLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editLinkText: {
    fontSize: 13,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.accentPurple,
  },
  transText: {
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  playbackContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(9, 9, 9, 0.05)',
    paddingTop: 16,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrubberTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(9, 9, 9, 0.08)',
    borderRadius: 2,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: 4,
    backgroundColor: colors.primary,
  },
  speedButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speedText: {
    fontSize: 12,
    fontFamily: typography.tabular.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  languageModalContent: {
    maxHeight: '82%',
    paddingBottom: 10,
  },
  languageModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  languageModalSubtitle: {
    fontSize: 12,
    fontFamily: typography.body.fontFamily,
    color: colors.textMuted,
    marginTop: -10,
    marginBottom: 12,
  },
  languageCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSoft,
  },
  languageList: {
    flexGrow: 0,
  },
  languageListItem: {
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  languageListItemSelected: {
    backgroundColor: colors.surfaceSoft,
  },
  languageListName: {
    fontSize: 15,
    fontFamily: typography.bodySemibold.fontFamily,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  languageListNative: {
    fontSize: 12,
    fontFamily: typography.body.fontFamily,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalHeading: {
    fontSize: 17,
    fontFamily: typography.heading4.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textSecondary,
  },
  modalBtnSave: {
    backgroundColor: colors.primary,
  },
  modalBtnSaveText: {
    fontSize: 15,
    fontFamily: typography.bodySemibold.fontFamily,
    fontWeight: '700',
    color: colors.textInverse,
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
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
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
  historyTranslatedText: {
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
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
