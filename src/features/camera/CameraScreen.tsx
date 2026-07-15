import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { useCameraState, CameraStateProvider } from './cameraState';
import { CameraViewfinder } from './CameraViewfinder';
import { CameraScannerOverlay } from './CameraScannerOverlay';
import { CameraCapturedPreview } from './CameraCapturedPreview';
import { CameraAnalysisStatus } from './CameraAnalysisStatus';
import { CameraResultSheet } from './CameraResultSheet';
import { CameraLanguageSheet } from './CameraLanguageSheet';
import { CameraFollowUp } from './CameraFollowUp';
import { VisualAnalysisResult } from './cameraTypes';
import { uriToBase64 } from './cameraUtils';

import { colors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAudioPlayer } from 'expo-audio';

import { useAuth } from '../../contexts/AuthContext';
import { visualAnalysisService } from '../../services/visualAnalysisService';
import { elevenLabsService } from '../../services/elevenLabs';
import { useCreateActivity } from '../../hooks/useActivityHistory';
import { historyService } from '../../services/historyService';
import { getLanguageName } from '../../constants/languages';

class WebPCMPlayer {
  private audioCtx: AudioContext | null = null;
  private startTime = 0;
  private sampleRate = 24000;

  constructor() {
    try {
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.startTime = this.audioCtx?.currentTime || 0;
    } catch (e) {
      console.warn('Web AudioContext is not supported on this browser:', e);
    }
  }

  playChunk(base64Data: string) {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    try {
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = this.audioCtx.createBuffer(1, float32Array.length, this.sampleRate);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);

      if (this.startTime < this.audioCtx.currentTime) {
        this.startTime = this.audioCtx.currentTime;
      }
      source.start(this.startTime);
      this.startTime += audioBuffer.duration;
    } catch (err) {
      console.warn('Failed to play PCM audio chunk:', err);
    }
  }

  stop() {
    try {
      if (this.audioCtx) {
        this.audioCtx.close();
        this.audioCtx = null;
      }
    } catch (e) {
      console.warn('Failed to close AudioContext:', e);
    }
  }
}

const CameraNativeAudio: React.FC<{
  nativeTtsUrl: string | null;
  isPlayingLiveAudio: boolean;
  setIsPlayingLiveAudio: (playing: boolean) => void;
  playerRef: React.MutableRefObject<any>;
}> = ({ nativeTtsUrl, isPlayingLiveAudio, setIsPlayingLiveAudio, playerRef }) => {
  const player = useAudioPlayer(nativeTtsUrl || '');

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    if (isPlayingLiveAudio && player) {
      if (!player.playing && player.currentTime >= player.duration - 0.2) {
        setIsPlayingLiveAudio(false);
      }
    }
  }, [player.playing, player.currentTime, isPlayingLiveAudio]);

  return null;
};

const CameraScreenContent: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const createActivityMutation = useCreateActivity();

  const {
    cameraState,
    setCameraState,
    cameraMode,
    setCameraMode,
    targetLanguage,
    capturedImageUri,
    setCapturedImageUri,
    capturedImageBase64,
    setCapturedImageBase64,
    visualResult,
    setVisualResult,
    spokenTranscript,
    setSpokenTranscript,
    isPlayingLiveAudio,
    setIsPlayingLiveAudio,
    errorMessage,
    setErrorMessage,
    flashMode,
    setFlashMode,
    currentRequestId,
    abortControllerRef,
    liveWsRef,
    pcmPlayerRef,
    resetCameraSession,
  } = useCameraState();

  const [langSheetVisible, setLangSheetVisible] = useState(false);
  const [nativeTtsUrl, setNativeTtsUrl] = useState<string | null>(null);
  const playerRef = useRef<any>(null);

  // Reset session on mount and unmount
  useEffect(() => {
    resetCameraSession();
    return () => {
      resetCameraSession();
    };
  }, []);

  const handleImageSource = async (uri: string, webFile?: File) => {
    try {
      setCapturedImageUri(uri);
      setCameraState('preparing');
      
      const base64 = await uriToBase64(uri);
      setCapturedImageBase64(base64);

      await runAnalysis(uri, base64);
    } catch (err: any) {
      console.error(err);
      setCameraState('error');
      setErrorMessage(err.message || 'Image processing failed');
    }
  };

  const runAnalysis = async (imageUri: string, base64Data: string) => {
    setCameraState('analysing');
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 1. Trigger HTTP Secure server-side visual analysis
      const result = await visualAnalysisService.analyseCapturedImage(
        imageUri,
        targetLanguage,
        cameraMode
      );

      setVisualResult(result);
      setCameraState('result');

      // 2. Save activity into Supabase history
      let storagePath = '';
      try {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        storagePath = await historyService.uploadFile(
          'camera',
          currentRequestId,
          'capture.jpg',
          blob,
          'image/jpeg'
        );
      } catch (uploadErr) {
        console.warn('Storage upload failed, continuing without asset path:', uploadErr);
      }

      const isFood = result.category === 'food';
      const nutrition = result.food?.estimatedNutrition;
      
      if (user) {
        await createActivityMutation.mutateAsync({
          client_request_id: currentRequestId,
          tool: 'camera',
          operation_type: isFood ? 'food' : 'visual_analysis',
          title: result.title,
          source_language: result.detectedLanguage?.code || 'auto',
          target_language: targetLanguage,
          source_text: result.defaultTranslation?.sourceText || result.title,
          translated_text: result.defaultTranslation?.translatedText || result.summary,
          input_asset_path: storagePath || undefined,
          transcript: result.spokenSummary,
          metadata: {
            category: result.category,
            confidence: result.confidence,
            detectedLanguage: result.detectedLanguage,
            entities: result.entities,
            product: result.product,
            food: result.food,
            landmark: result.landmark,
            // Flat props for history screen rendering compatibility
            calories: nutrition?.calories || 0,
            protein: nutrition?.protein_g ? `${nutrition.protein_g}g` : '0g',
            carbs: nutrition?.carbs_g ? `${nutrition.carbs_g}g` : '0g',
            fat: nutrition?.fat_g ? `${nutrition.fat_g}g` : '0g',
          },
        });
      }

      // 3. Auto-speak description
      startSpeechSynthesis(result);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      
      let title = 'Analysis Failed';
      let msg = err.message || 'An error occurred during scanning.';
      if (err.status === 429) {
        title = 'Gemini limit reached';
        msg = 'Too many Gemini requests have been made. Please wait and try again later.';
      } else if (err.status === 503) {
        title = 'Gemini temporarily unavailable';
        msg = 'The visual service is currently busy. Please try again shortly.';
      }

      setCameraState('error');
      setErrorMessage(`${title}: ${msg}`);
    }
  };

  const startSpeechSynthesis = async (result: VisualAnalysisResult) => {
    setIsPlayingLiveAudio(true);
    setSpokenTranscript('');

    if (Platform.OS === 'web') {
      try {
        const { token } = await visualAnalysisService.getLiveSessionToken();
        pcmPlayerRef.current = new WebPCMPlayer();

        const wsUrl = `wss://jstylllvekaqibooizbl.supabase.co/functions/v1/create-gemini-live-token?token=${token}`;
        const ws = new WebSocket(wsUrl);
        liveWsRef.current = ws;

        ws.onopen = () => {
          const setupMsg = {
            setup: {
              model: 'models/gemini-2.0-flash-exp',
              generationConfig: {
                responseModalities: ['audio'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: 'Aoede',
                    },
                  },
                },
              },
            },
          };
          ws.send(JSON.stringify(setupMsg));

          const prompt = `Explain the following visual analysis result naturally and concisely. Keep it to 2-3 sentences.
Result category: ${result.category}
Result Title: ${result.title}
Result Summary: ${result.summary}
Spoken Summary: ${result.spokenSummary || ''}
Target Language: ${targetLanguage}`;

          const contentMsg = {
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: prompt }],
                },
              ],
              turnComplete: true,
            },
          };
          ws.send(JSON.stringify(contentMsg));
        };

        ws.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data);
            const parts = raw.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.text) {
                setSpokenTranscript((prev) => prev + part.text);
              }
              if (part.inlineData && part.inlineData.data && pcmPlayerRef.current) {
                pcmPlayerRef.current.playChunk(part.inlineData.data);
              }
            }
          } catch (err) {
            console.warn('Failed to parse Gemini Live message:', err);
          }
        };

        ws.onclose = () => {
          setIsPlayingLiveAudio(false);
        };

        ws.onerror = (err) => {
          console.warn('WebSocket error:', err);
          setIsPlayingLiveAudio(false);
        };
      } catch (err) {
        console.warn('Failed to init Gemini Live on web:', err);
        setIsPlayingLiveAudio(false);
      }
    } else {
      // Native compatible audio playback using ElevenLabs
      try {
        const textToSpeak = result.spokenSummary || result.summary;
        const res = await elevenLabsService.generateSpeech(
          textToSpeak,
          '21m00Tcm4TlvDq8ikWAM',
          true
        );
        if (res && res.url) {
          setNativeTtsUrl(res.url);
          if (playerRef.current) {
            playerRef.current.replace({ uri: res.url });
            playerRef.current.play();
          }
        } else {
          throw new Error('TTS empty URL');
        }
      } catch (err) {
        console.warn('Native speech fallback error:', err);
        setIsPlayingLiveAudio(false);
      }
    }
  };

  const handleSaveCorrection = async (corrected: any) => {
    if (!visualResult) return;
    const isFood = visualResult.category === 'food';
    if (!isFood) return;

    const updatedResult: VisualAnalysisResult = {
      ...visualResult,
      title: corrected.name,
      food: {
        ...visualResult.food,
        name: corrected.name,
        visibleIngredients: corrected.ingredients,
        estimatedNutrition: {
          calories: corrected.calories,
          protein_g: corrected.protein,
          carbs_g: corrected.carbs,
          fat_g: corrected.fat,
        },
      },
    };

    setVisualResult(updatedResult);

    // Save corrected details back to Supabase
    try {
      const existing = await historyService.listActivities({
        tool: 'camera',
        limit: 1,
      });

      if (existing && existing.length > 0) {
        const latest = existing[0];
        await historyService.updateActivity(latest.id, {
          title: corrected.name,
          source_text: corrected.name,
          translated_text: `Calories: ${corrected.calories}kcal | P: ${corrected.protein}g | C: ${corrected.carbs}g | F: ${corrected.fat}g`,
          metadata: {
            ...latest.metadata,
            title: corrected.name,
            food: updatedResult.food,
            calories: corrected.calories,
            protein: `${corrected.protein}g`,
            carbs: `${corrected.carbs}g`,
            fat: `${corrected.fat}g`,
          },
        });
      }
    } catch (err) {
      console.warn('Failed to update corrected database history:', err);
    }
  };

  const triggerGalleryImport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Gallery access is required to import photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleImageSource(result.assets[0].uri);
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Import Failed', err.message || 'Could not pick image.');
    }
  };

  const toggleFlash = () => {
    Haptics.selectionAsync();
    setFlashMode(flashMode === 'on' ? 'off' : 'on');
  };

  const handleBack = () => {
    resetCameraSession();
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { height }]}>
      {/* Top Bar Navigation */}
      <View style={styles.topBar}>
        <Pressable style={styles.navIcon} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.titleText}>YSnap Lens</Text>
        <Pressable style={styles.langSelector} onPress={() => setLangSheetVisible(true)}>
          <Text style={styles.langSelectorText}>{getLanguageName(targetLanguage)}</Text>
          <Ionicons name="chevron-down" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </Pressable>
      </View>

      {/* Viewfinders and overlays */}
      <View style={styles.viewport}>
        <CameraViewfinder onImageCaptured={handleImageSource} />

        <CameraCapturedPreview />
        <CameraScannerOverlay />
        <CameraAnalysisStatus />
      </View>

      {/* Result Bottom Sheet */}
      <CameraResultSheet
        onSaveCorrection={handleSaveCorrection}
        onRetake={resetCameraSession}
        onSpeak={() => visualResult && startSpeechSynthesis(visualResult)}
        onDone={handleBack}
      />

      {/* Follow-up experience */}
      <CameraFollowUp />

      {/* Bottom Controls (Only visible in ready / idle state) */}
      {(cameraState === 'ready' || cameraState === 'opening_camera') && (
        <View style={styles.bottomBar}>
          <Pressable style={styles.sideBtn} onPress={triggerGalleryImport}>
            <Ionicons name="images-outline" size={24} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={styles.captureBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (Platform.OS === 'web') {
                const captureFunc = (window as any).__webCameraCapture;
                if (captureFunc) captureFunc();
              } else {
                const captureFunc = (globalThis as any).__nativeCameraCapture;
                if (captureFunc) captureFunc();
              }
            }}
          >
            <View style={styles.captureBtnInner} />
          </Pressable>

          <Pressable style={styles.sideBtn} onPress={toggleFlash}>
            <Ionicons
              name={flashMode === 'on' ? 'flash' : 'flash-off-outline'}
              size={24}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      )}

      {/* Camera Mode Selector */}
      {(cameraState === 'ready' || cameraState === 'opening_camera') && (
        <View style={styles.modeSelector}>
          {(['ocr', 'food', 'menu'] as const).map((m) => {
            const isActive = cameraMode === m;
            return (
              <Pressable
                key={m}
                style={[styles.modeTab, isActive && styles.modeTabActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setCameraMode(m);
                }}
              >
                <Text style={[styles.modeTabText, isActive && styles.modeTabTextActive]}>
                  {m.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Language Selector Modal */}
      <CameraLanguageSheet
        visible={langSheetVisible}
        onClose={() => setLangSheetVisible(false)}
        onLanguageSelected={(code) => {
          if (visualResult && capturedImageUri && capturedImageBase64) {
            runAnalysis(capturedImageUri, capturedImageBase64);
          }
        }}
      />
      {Platform.OS !== 'web' && (
        <CameraNativeAudio
          nativeTtsUrl={nativeTtsUrl}
          isPlayingLiveAudio={isPlayingLiveAudio}
          setIsPlayingLiveAudio={setIsPlayingLiveAudio}
          playerRef={playerRef}
        />
      )}
    </SafeAreaView>
  );
};

export const CameraScreen: React.FC = () => {
  return (
    <CameraStateProvider>
      <CameraScreenContent />
    </CameraStateProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    zIndex: 10,
  },
  navIcon: {
    padding: 6,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  langSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  langSelectorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  viewport: {
    flex: 1,
    position: 'relative',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 24,
  },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  modeSelector: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10,
  },
  modeTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A9A9A9',
    letterSpacing: 0.5,
  },
  modeTabTextActive: {
    color: '#000000',
  },
});
