import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  Linking,
  Platform,
  Modal,
  TextInput,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { colors, lightColors } from '@/constants/colors';
import { spacing, layout, shadows } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getLanguageName } from '@/constants/languages';
import { generateUUID } from '../../utils/uuid';
import { useCreateActivity, useActivityHistoryList, useDeleteActivity } from '../../hooks/useActivityHistory';
import { historyService } from '../../services/historyService';
import { visualAnalysisService, VisualAnalysisResult, VisualAnalysisCategory } from '../../services/visualAnalysisService';

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
      console.warn("Web AudioContext is not supported on this browser:", e);
    }
  }

  playChunk(base64Data: string) {
    if (!this.audioCtx) return;
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
      console.warn("Failed to play PCM audio chunk:", err);
    }
  }

  stop() {
    try {
      if (this.audioCtx) {
        this.audioCtx.close();
        this.audioCtx = null;
      }
    } catch (e) {
      console.warn("Failed to close AudioContext:", e);
    }
  }
}

type CameraMode = 'ocr' | 'food' | 'menu';
type CameraState =
  | 'requesting_permission'
  | 'permission_denied'
  | 'ready'
  | 'capturing'
  | 'captured'
  | 'preparing'
  | 'analysing'
  | 'result'
  | 'follow_up'
  | 'error';

const searchLanguages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' }
];

export default function CameraScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const styles = createStyles(colors);
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  // State Machine
  const [cameraState, setCameraState] = useState<CameraState>('ready');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');

  const [currentRequestId, setCurrentRequestId] = useState(generateUUID());
  const [historyVisible, setHistoryVisible] = useState(false);

  const createActivityMutation = useCreateActivity();
  const deleteActivityMutation = useDeleteActivity();
  const { data: history = [], isLoading: loadingHistory } = useActivityHistoryList({ tool: 'camera', limit: 5 });

  // Permissions hook (Native only)
  const [permission, requestPermission] = useCameraPermissions();

  // Camera Settings
  const [mode, setMode] = useState<CameraMode>('ocr');
  const [flash, setFlash] = useState<FlashMode>('off');
  const cameraRef = useRef<any>(null);

  // Web MediaStream References
  const videoRef = useRef<any>(null);
  const [webStream, setWebStream] = useState<any>(null);

  // Image URI and Results
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<VisualAnalysisResult | null>(null);

  // Translation states
  const [langSheetVisible, setLangSheetVisible] = useState(false);
  const [langSearchQuery, setLangSearchQuery] = useState('');
  const [translationResult, setTranslationResult] = useState<string | null>(null);
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState<string | null>(null);

  // Follow-up interaction states
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpHistory, setFollowUpHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // Gemini Live states
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [isPlayingLiveAudio, setIsPlayingLiveAudio] = useState(false);
  const liveWsRef = useRef<WebSocket | null>(null);
  const pcmPlayerRef = useRef<WebPCMPlayer | null>(null);

  // Microanimations references
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const focusScale = useRef(new Animated.Value(1)).current;
  const focusOpacity = useRef(new Animated.Value(1)).current;
  const [focusIndicator, setFocusIndicator] = useState<{ x: number; y: number } | null>(null);

  const navigation = useNavigation();
  const isFocused = navigation.isFocused();

  // Profile preferences
  const { data: profile } = useQuery<any>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('primary_target_language').eq('id', user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });
  const targetLanguage = profile?.primary_target_language || 'en';

  const resetCameraSession = () => {
    stopSpeaking();
    setCapturedImage(null);
    setAnalysisResult(null);
    setCameraState('ready');
    setErrorMessage(null);
    setProgressMessage('');
    setTranslationResult(null);
    setSelectedTargetLanguage(null);
    setFollowUpQuestion('');
    setFollowUpHistory([]);
    setFollowUpLoading(false);
    setCurrentRequestId(generateUUID());
  };

  const stopSpeaking = () => {
    setIsPlayingLiveAudio(false);
    if (liveWsRef.current) {
      try {
        liveWsRef.current.close();
      } catch (e) {}
      liveWsRef.current = null;
    }
    if (Platform.OS === 'web' && pcmPlayerRef.current) {
      try {
        pcmPlayerRef.current.stop();
      } catch (e) {}
      pcmPlayerRef.current = null;
    }
  };

  const startLiveSession = async (imageBase64: string, result: VisualAnalysisResult) => {
    stopSpeaking();
    setSpokenTranscript('');
    setIsPlayingLiveAudio(true);

    try {
      const { token } = await visualAnalysisService.getLiveSessionToken();
      
      if (Platform.OS === 'web') {
        pcmPlayerRef.current = new WebPCMPlayer();
      }

      const wsUrl = `wss://jstylllvekaqibooizbl.supabase.co/functions/v1/create-gemini-live-token?token=${token}`;
      const ws = new WebSocket(wsUrl);
      liveWsRef.current = ws;

      ws.onopen = () => {
        const setupMsg = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            generationConfig: {
              responseModalities: ["audio"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Aoede"
                  }
                }
              }
            }
          }
        };
        ws.send(JSON.stringify(setupMsg));

        const prompt = `Explain the following visual analysis result naturally and concisely. Keep it to 2-3 sentences.
Result category: ${result.category}
Result Title: ${result.title}
Result Summary: ${result.summary}
Spoken Summary: ${result.spokenSummary || ''}
Target Language: ${selectedTargetLanguage || targetLanguage}`;

        const contentMsg = {
          clientContent: {
            turns: [
              {
                role: "user",
                parts: [
                  { text: prompt }
                ]
              }
            ],
            turnComplete: true
          }
        };
        ws.send(JSON.stringify(contentMsg));
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const parts = raw.serverContent?.modelTurn?.parts || [];
          for (const part of parts) {
            if (part.text) {
              setSpokenTranscript(prev => prev + part.text);
            }
            if (part.inlineData && part.inlineData.data) {
              if (Platform.OS === 'web' && pcmPlayerRef.current) {
                pcmPlayerRef.current.playChunk(part.inlineData.data);
              }
            }
          }
        } catch (err) {
          console.warn("Failed to parse Gemini Live message:", err);
        }
      };

      ws.onclose = () => {
        setIsPlayingLiveAudio(false);
      };

      ws.onerror = (err) => {
        console.warn("Gemini Live WS error:", err);
        setIsPlayingLiveAudio(false);
      };

    } catch (err: any) {
      console.warn("Failed to start Live session:", err);
      setIsPlayingLiveAudio(false);
      Alert.alert("Gemini Live error", err.message || "Failed to start audio explanation.");
    }
  };

  // Web Camera start
  const startWebCamera = async () => {
    if (Platform.OS !== 'web') return;
    try {
      setCameraState('requesting_permission');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      setWebStream(stream);
      setCameraState('ready');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e: any) => console.log('Video play error:', e));
      }
    } catch (err: any) {
      console.warn('Web media stream permission error:', err);
      setCameraState('permission_denied');
      setErrorMessage(err.message || 'Camera permission was denied. Upload an image instead.');
    }
  };

  // Web Camera stop
  const stopWebCamera = () => {
    if (Platform.OS !== 'web') return;
    if (webStream) {
      webStream.getTracks().forEach((track: any) => track.stop());
      setWebStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Handle Tab Focus Lifecycle
  useFocusEffect(
    React.useCallback(() => {
      resetCameraSession();
      if (Platform.OS === 'web') {
        startWebCamera();
      }
      return () => {
        resetCameraSession();
        if (Platform.OS === 'web') {
          stopWebCamera();
        }
      };
    }, [navigation])
  );

  // Handle Web Page Visibility Changes
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopWebCamera();
      } else if (isFocused && !capturedImage) {
        startWebCamera();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isFocused, capturedImage, webStream]);

  // Breathing brackets animation
  useEffect(() => {
    if (cameraState === 'ready') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 0.7,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 1.0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      breatheAnim.setValue(1.0);
    }
  }, [cameraState]);

  // Scanner vertical bar animation
  useEffect(() => {
    if (cameraState === 'preparing' || cameraState === 'analysing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: false,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [cameraState]);

  // Gradual progress messages animation
  useEffect(() => {
    if (cameraState === 'preparing' || cameraState === 'analysing') {
      const messages = [
        "Looking at the image",
        "Reading visible text",
        "Detecting the language",
        "Identifying objects",
        "Preparing your explanation"
      ];
      let idx = 0;
      setProgressMessage(messages[0]);
      const interval = setInterval(() => {
        idx = (idx + 1) % messages.length;
        setProgressMessage(messages[idx]);
      }, 1800);
      return () => {
        clearInterval(interval);
      };
    }
  }, [cameraState]);

  const triggerShutterFlash = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleFocusTap = (e: any) => {
    if (cameraState !== 'ready') return;
    const { locationX, locationY } = e.nativeEvent;
    setFocusIndicator({ x: locationX, y: locationY });
    focusScale.setValue(1.3);
    focusOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(focusScale, {
        toValue: 0.8,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(focusOpacity, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFocusIndicator(null);
    });
  };

  // Flash Toggle
  const toggleFlash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  // Main Capture Trigger
  const handleCapture = async () => {
    if (cameraState !== 'ready') return;

    try {
      setCameraState('capturing');
      triggerShutterFlash();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      if (Platform.OS === 'web') {
        if (!videoRef.current) throw new Error('Webcam not ready');
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
        setCameraState('captured');
        stopWebCamera();
        await handleStartAnalysis(dataUrl);
      } else {
        if (!cameraRef.current) throw new Error('Camera view not initialized');
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: false,
        });
        setCapturedImage(photo.uri);
        setCameraState('captured');
        await handleStartAnalysis(photo.uri);
      }
    } catch (err: any) {
      console.error('Capture error:', err);
      setCameraState('error');
      setErrorMessage(err.message || 'Could not capture this image.');
      Alert.alert('Camera Error', err.message || 'Could not capture this image.');
    }
  };

  // Gallery Picker
  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setCapturedImage(uri);
        setCameraState('captured');
        if (Platform.OS === 'web') {
          stopWebCamera();
        }
        await handleStartAnalysis(uri);
      }
    } catch (err) {
      console.log('Image picker error:', err);
    }
  };

  const handleGeminiError = (error: any) => {
    console.error("Gemini Error:", error);
    const message = error.message || String(error);
    
    let title = "Camera Translation Error";
    let body = "Failed to analyze this image. Please try again.";

    if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
      title = "Gemini limit reached";
      body = "We've received too many requests right now. Please wait a little while and try again.";
    } else if (message.includes("403") || message.includes("PERMISSION_DENIED")) {
      title = "Permission Denied";
      body = "The Gemini API key does not have access to this model.";
    } else if (message.includes("401") || message.includes("authentication failed")) {
      title = "Authentication Failed";
      body = "Gemini authentication failed. Check the secure server configuration.";
    } else if (message.includes("400") || message.includes("INVALID_ARGUMENT")) {
      title = "Invalid Image";
      body = "This image could not be processed. Try another image.";
    } else if (message.includes("413") || message.includes("oversized")) {
      title = "Image Too Large";
      body = "This image is too large. Choose a smaller image.";
    } else if (message.includes("503") || message.includes("UNAVAILABLE")) {
      title = "Service Unavailable";
      body = "Gemini is temporarily unavailable. Please try again shortly.";
    } else if (message.includes("504") || message.includes("timeout")) {
      title = "Timeout";
      body = "The analysis took too long. Try again with a clearer or smaller image.";
    } else if (message.includes("500")) {
      title = "Unexpected Error";
      body = "Gemini encountered an unexpected error. Please try again.";
    }

    setErrorMessage(body);
    setCameraState('error');
    Alert.alert(title, body, [
      { text: "Close", style: "cancel" }
    ]);
  };

  // Run Visual Analysis
  const handleStartAnalysis = async (imageUri?: string) => {
    const targetImage = imageUri || capturedImage;
    if (!targetImage) return;

    setCameraState('preparing');
    try {
      setCameraState('analysing');

      const data = await visualAnalysisService.analyseCapturedImage(targetImage, targetLanguage, mode);
      
      // Enforce default translation values if missing
      if (!data.defaultTranslation) {
        data.defaultTranslation = {
          sourceLanguage: data.detectedLanguage?.name || 'auto',
          targetLanguage: 'en',
          sourceText: data.detectedText?.[0]?.text || '',
          translatedText: data.summary || ''
        };
      }

      setAnalysisResult(data);
      setCameraState('result');

      // Play Gemini Live speech explanation!
      startLiveSession(targetImage, data);

      // Save to unified activity_history in Supabase
      if (user) {
        try {
          const titleText = data.title || (mode === 'food' 
            ? `Food Scan: ${data.food?.name || 'Detected food'}`
            : mode === 'menu' 
              ? 'Menu Scan Translation' 
              : 'OCR Text Scan Translation');

          const activity = await createActivityMutation.mutateAsync({
            client_request_id: currentRequestId,
            tool: 'camera',
            operation_type: mode,
            title: titleText,
            source_text: data.defaultTranslation?.sourceText || data.detectedText?.[0]?.text || data.summary || 'Camera scan image',
            translated_text: data.defaultTranslation?.translatedText || data.detectedText?.[0]?.translatedText || '',
            metadata: {
              mode,
              category: data.category,
              confidence: data.confidence,
              product: data.product,
              food: data.food,
              landmark: data.landmark,
            }
          });

          // Upload captured image file to history-files storage
          const imgResponse = await fetch(targetImage);
          const imgBlob = await imgResponse.blob();
          const imgPath = await historyService.uploadFile('camera', activity.id, 'captured.jpg', imgBlob, 'image/jpeg');

          await historyService.updateActivity(activity.id, {
            input_asset_path: imgPath,
          });
        } catch (historyErr) {
          console.warn('Failed to save camera scan to unified history or upload image:', historyErr);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['activityHistory', user?.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      handleGeminiError(error);
    }
  };

  const handleCopyText = () => {
    if (!analysisResult) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const textToCopy = analysisResult.detectedText?.[0]?.text || analysisResult.summary;
    Alert.alert('Copied to Clipboard', textToCopy);
  };

  // Translate detected text manually
  const handleOpenLanguageSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLangSheetVisible(true);
  };

  const handleSelectLanguage = async (langCode: string) => {
    setLangSheetVisible(false);
    setSelectedTargetLanguage(langCode);
    setCameraState('analysing');
    try {
      const sourceText = analysisResult?.detectedText?.[0]?.text || analysisResult?.summary || '';
      // Fallback manual translation call
      const { data, error } = await callEdgeFunction<any>('translate-text', {
        text: sourceText,
        target: langCode
      });
      if (error || !data) throw error || new Error('Translation failed');
      setTranslationResult(data.translated_text);
      setCameraState('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setCameraState('error');
      setErrorMessage(err.message || 'Failed to translate.');
      Alert.alert('Error', err.message || 'Failed to translate.');
    }
  };

  // Conversational Follow-up
  const handleSendFollowUp = async () => {
    if (!followUpQuestion.trim() || followUpLoading) return;
    const question = followUpQuestion.trim();
    setFollowUpQuestion('');
    setFollowUpLoading(true);

    const newUserMsg = { role: 'user' as const, text: question };
    setFollowUpHistory(prev => [...prev, newUserMsg]);

    try {
      // Call mock visualAnalysisService visual follow-up (throws "not configured")
      // With fallback display message
      let reply: string;
      try {
        reply = await visualAnalysisService.askVisualFollowUp(capturedImage || '', followUpHistory, question);
      } catch (err: any) {
        if (err.message?.includes('not configured')) {
          reply = "Gemini visual analysis follow-up is not configured yet. This interface is fully prepared to receive replies.";
        } else {
          throw err;
        }
      }
      setFollowUpHistory(prev => [...prev, { role: 'model' as const, text: reply }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setFollowUpHistory(prev => [...prev, { role: 'model' as const, text: `Error: ${err.message || 'Failed to get answer.'}` }]);
    } finally {
      setFollowUpLoading(false);
    }
  };

  // Selected history scan
  const handleSelectHistoryItem = async (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHistoryVisible(false);
    
    if (item.operation_type === 'food' || item.operation_type === 'menu' || item.operation_type === 'ocr') {
      setMode(item.operation_type as CameraMode);
    }
    
    const resVal: VisualAnalysisResult = {
      category: item.operation_type === 'food' ? 'food' : 'text',
      title: item.title || 'History Scan',
      summary: item.translated_text || item.source_text || '',
      suggestedActions: ['translate', 'ask_follow_up']
    };

    if (item.operation_type === 'food') {
      (resVal as any).foodInfo = {
        name: item.source_text,
        translatedName: item.translated_text,
        calories: item.metadata?.calories || 0,
        protein: item.metadata?.protein || '0g',
        carbs: item.metadata?.carbs || '0g',
        fat: item.metadata?.fat || '0g',
        allergens: item.metadata?.allergens || [],
        confidence: item.metadata?.confidence || 100
      };
    } else {
      resVal.detectedText = [{ text: item.source_text }];
    }

    setAnalysisResult(resVal);
    setCameraState('result');

    if (item.input_asset_path) {
      try {
        const url = await historyService.getSignedUrl(item.input_asset_path);
        if (url) setCapturedImage(url);
      } catch (err) {
        console.warn('Failed to load history image asset:', err);
        setCapturedImage(null);
      }
    } else {
      setCapturedImage(null);
    }
  };

  const handleDeleteHistoryItem = (itemId: string) => {
    Alert.alert(
      'Delete History Item',
      'Are you sure you want to delete this scan from history?',
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
              Alert.alert('Deletion Error', err.message || 'Failed to delete.');
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
      Alert.alert('Export Error', err.message || 'Failed to export.');
    }
  };

  // Dynamic status bar and layout permissions checks
  if (Platform.OS !== 'web') {
    if (!permission) {
      return (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (!permission.granted) {
      const cannotAskAgain = !permission.canAskAgain;
      return (
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.disabled} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            {cannotAskAgain
              ? "Camera access was permanently denied. Please enable it in Settings to translate menus, signs, or products."
              : "We need permission to use the camera to translate menus, text, and scan food products."}
          </Text>
          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={cannotAskAgain ? () => Linking.openSettings() : requestPermission}
          >
            <Text style={styles.primaryBtnText}>
              {cannotAskAgain ? "Open Settings" : "Grant Permission"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 12, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border }]} onPress={handlePickImage}>
            <Text style={[styles.primaryBtnText, { color: colors.textPrimary }]}>Upload Image Instead</Text>
          </TouchableOpacity>
        </View>
      );
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Scan & translate</Text>
          <Text style={styles.headerSubtitle}>Auto detect → {getLanguageName(targetLanguage)}</Text>
        </View>
        <TouchableOpacity style={styles.flashBtn} onPress={toggleFlash} disabled={!!capturedImage}>
          <Ionicons
            name={flash === 'on' ? 'flash' : 'flash-off-outline'}
            size={22}
            color={flash === 'on' ? colors.accentOrange : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Mode Selector Tab */}
      {!capturedImage && (
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'ocr' && styles.modeTabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setMode('ocr');
            }}
          >
            <Ionicons name="text-outline" size={16} color={colors.textPrimary} />
            <Text style={[styles.modeTabText, mode === 'ocr' && styles.modeTabTextActive]}>Text</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, mode === 'food' && styles.modeTabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setMode('food');
            }}
          >
            <Ionicons name="nutrition-outline" size={16} color={colors.textPrimary} />
            <Text style={[styles.modeTabText, mode === 'food' && styles.modeTabTextActive]}>Nutrition</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, mode === 'menu' && styles.modeTabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setMode('menu');
            }}
          >
            <Ionicons name="restaurant-outline" size={16} color={colors.textPrimary} />
            <Text style={[styles.modeTabText, mode === 'menu' && styles.modeTabTextActive]}>Menu</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Viewfinder / Preview Screen */}
      <View style={styles.viewfinderContainer}>
        {capturedImage ? (
          /* PREVIEW STATE */
          <View style={styles.previewWrapper}>
            <Image source={{ uri: capturedImage }} style={styles.previewImage} resizeMode="contain" />

            {(cameraState === 'preparing' || cameraState === 'analysing') && (
              <View style={styles.processingMask}>
                {/* Four clean corner boundaries */}
                <View style={styles.scannerCorners}>
                  <View style={[styles.cornerBracket, styles.bracketTopLeft, { borderColor: '#9F55FF' }]} />
                  <View style={[styles.cornerBracket, styles.bracketTopRight, { borderColor: '#9F55FF' }]} />
                  <View style={[styles.cornerBracket, styles.bracketBottomLeft, { borderColor: '#9F55FF' }]} />
                  <View style={[styles.cornerBracket, styles.bracketBottomRight, { borderColor: '#9F55FF' }]} />
                </View>

                {/* Vertical Scanner bar and glow */}
                <Animated.View 
                  style={[
                    styles.scannerBarGlow,
                    {
                      top: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['15%', '85%']
                      })
                    }
                  ]}
                />
                <Animated.View 
                  style={[
                    styles.scannerBar,
                    {
                      top: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['15%', '85%']
                      })
                    }
                  ]}
                />

                <ActivityIndicator size="large" color="#9F55FF" style={{ marginTop: 40 }} />
                <Text style={styles.processingText}>{progressMessage}</Text>
              </View>
            )}
          </View>
        ) : (
          /* CAMERA VIEW STATE */
          isFocused ? (
            Platform.OS === 'web' ? (
              <View style={styles.webCameraContainer} onTouchEnd={handleFocusTap}>
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  playsInline
                  muted
                />
                
                {/* Corner Google Lens brackets overlay */}
                <View style={styles.lensContainer}>
                  <Animated.View style={[styles.cornerBracket, styles.bracketTopLeft, { opacity: breatheAnim }]} />
                  <Animated.View style={[styles.cornerBracket, styles.bracketTopRight, { opacity: breatheAnim }]} />
                  <Animated.View style={[styles.cornerBracket, styles.bracketBottomLeft, { opacity: breatheAnim }]} />
                  <Animated.View style={[styles.cornerBracket, styles.bracketBottomRight, { opacity: breatheAnim }]} />
                  
                  {/* Tap focus ring */}
                  {focusIndicator && (
                    <Animated.View 
                      style={[
                        styles.focusRing,
                        {
                          left: focusIndicator.x - 20,
                          top: focusIndicator.y - 20,
                          transform: [{ scale: focusScale }],
                          opacity: focusOpacity
                        }
                      ]}
                    />
                  )}
                </View>
              </View>
            ) : (
              <CameraView style={styles.cameraView} flash={flash} ref={cameraRef} facing="back">
                <View style={styles.overlayFrameContainer}>
                  <View style={styles.lensContainer}>
                    <Animated.View style={[styles.cornerBracket, styles.bracketTopLeft, { opacity: breatheAnim }]} />
                    <Animated.View style={[styles.cornerBracket, styles.bracketTopRight, { opacity: breatheAnim }]} />
                    <Animated.View style={[styles.cornerBracket, styles.bracketBottomLeft, { opacity: breatheAnim }]} />
                    <Animated.View style={[styles.cornerBracket, styles.bracketBottomRight, { opacity: breatheAnim }]} />
                  </View>
                </View>
              </CameraView>
            )
          ) : (
            <View style={[styles.cameraView, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.textPrimary }]}>
              <ActivityIndicator color={colors.background} />
            </View>
          )
        )}
        
        {/* Shutter White Flash Mask */}
        <Animated.View style={[styles.shutterFlash, { opacity: flashAnim }]} pointerEvents="none" />
      </View>

      {/* Analysis Details Panel */}
      {analysisResult && cameraState === 'result' && (
        <ScrollView style={styles.resultsSheet} contentContainerStyle={styles.resultsSheetContent} showsVerticalScrollIndicator={false}>
          
          {/* Unified Category Badge & Title */}
          <View style={styles.resultHeaderCard}>
            <View style={styles.categoryBadgeRow}>
              <Text style={styles.categoryBadgeText}>
                {analysisResult.category.toUpperCase().replace('_', ' ')}
              </Text>
              {analysisResult.confidence && (
                <Text style={styles.confidenceText}>
                  {Math.round(analysisResult.confidence)}% Match
                </Text>
              )}
            </View>
            <Text style={styles.resultTitle}>{analysisResult.title}</Text>
            <Text style={styles.resultSummary}>{analysisResult.summary}</Text>
          </View>

          {/* Spoken Explanation & Live Transcript */}
          {(spokenTranscript !== '' || isPlayingLiveAudio) && (
            <View style={styles.spokenExplanationCard}>
              <View style={styles.spokenExplanationHeader}>
                <Text style={styles.spokenExplanationTitle}>SPOKEN EXPLANATION</Text>
                {isPlayingLiveAudio ? (
                  <TouchableOpacity style={styles.audioControlBtn} onPress={stopSpeaking}>
                    <Ionicons name="volume-mute-outline" size={16} color={colors.danger} />
                    <Text style={[styles.audioControlBtnText, { color: colors.danger }]}>Stop</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.audioControlBtn} onPress={() => startLiveSession(capturedImage || '', analysisResult)}>
                    <Ionicons name="volume-high-outline" size={16} color={colors.primary} />
                    <Text style={[styles.audioControlBtnText, { color: colors.primary }]}>Replay</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.spokenTranscriptText}>
                {spokenTranscript || "Connecting to Gemini Live..."}
              </Text>
              {!isPlayingLiveAudio && spokenTranscript !== '' && (
                <View style={styles.transcriptActionRow}>
                  <TouchableOpacity style={styles.transcriptActionBtn} onPress={() => Alert.alert("Copied", spokenTranscript)}>
                    <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.transcriptActionText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Text/Document OCR Card */}
          {(analysisResult.detectedText && analysisResult.detectedText.length > 0) && (
            <View style={styles.textReportCard}>
              <Text style={styles.sectionLabel}>DETECTED TEXT</Text>
              <Text style={styles.ocrSourceText}>
                {analysisResult.detectedText.map(t => t.text).join('\n')}
              </Text>
              
              {(translationResult || analysisResult.defaultTranslation?.translatedText) && (
                <>
                  <Ionicons name="arrow-down" size={18} color={colors.textMuted} style={styles.textArrow} />
                  <Text style={styles.sectionLabel}>TRANSLATION</Text>
                  <Text style={styles.ocrTranslatedText}>
                    {translationResult || analysisResult.defaultTranslation?.translatedText}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Product details */}
          {analysisResult.product && (
            <View style={styles.infoDetailsCard}>
              <Text style={styles.sectionLabel}>PRODUCT INFO</Text>
              <Text style={styles.detailRow}>Name: {analysisResult.product.name}</Text>
              <Text style={styles.detailRow}>Brand: {analysisResult.product.brand}</Text>
              {analysisResult.product.visibleClaims && analysisResult.product.visibleClaims.length > 0 && (
                <Text style={styles.detailRow}>Claims: {analysisResult.product.visibleClaims.join(', ')}</Text>
              )}
            </View>
          )}

          {/* Food details */}
          {analysisResult.food && (
            <View style={styles.infoDetailsCard}>
              <Text style={styles.sectionLabel}>FOOD & NUTRITION</Text>
              <Text style={styles.detailRow}>Item: {analysisResult.food.name}</Text>
              {analysisResult.food.visibleIngredients && analysisResult.food.visibleIngredients.length > 0 && (
                <Text style={styles.detailRow}>Ingredients: {analysisResult.food.visibleIngredients.join(', ')}</Text>
              )}
              {analysisResult.food.visibleNutritionText && analysisResult.food.visibleNutritionText.length > 0 && (
                <Text style={styles.detailRow}>Nutrition: {analysisResult.food.visibleNutritionText.join(', ')}</Text>
              )}
            </View>
          )}

          {/* Landmark details */}
          {analysisResult.landmark && (
            <View style={styles.infoDetailsCard}>
              <Text style={styles.sectionLabel}>LANDMARK INFO</Text>
              <Text style={styles.detailRow}>Name: {analysisResult.landmark.name}</Text>
              <Text style={styles.detailRow}>Location: {analysisResult.landmark.city}, {analysisResult.landmark.country}</Text>
              <Text style={styles.detailRow}>History: {analysisResult.landmark.briefHistory}</Text>
            </View>
          )}

          {/* Entities/Objects Card */}
          {analysisResult.entities && analysisResult.entities.length > 0 && (
            <View style={styles.entitiesCard}>
              <Text style={styles.sectionLabel}>IDENTIFIED OBJECTS</Text>
              <View style={styles.entityTagContainer}>
                {analysisResult.entities.map((ent, idx) => (
                  <View key={idx} style={styles.entityTag}>
                    <Text style={styles.entityTagText}>{ent.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtnOutline} onPress={handleCopyText}>
              <Ionicons name="copy-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.actionBtnTextOutline}>Copy</Text>
            </TouchableOpacity>

            {analysisResult.suggestedActions.includes('translate') && (
              <TouchableOpacity style={styles.actionBtnOutline} onPress={handleOpenLanguageSheet}>
                <Ionicons name="language-outline" size={18} color={colors.textPrimary} />
                <Text style={styles.actionBtnTextOutline}>Translate</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionBtnPrimary} onPress={resetCameraSession}>
              <Ionicons name="refresh" size={18} color={colors.textInverse} />
              <Text style={styles.actionBtnTextPrimary}>Retake</Text>
            </TouchableOpacity>
          </View>

          {/* Visual Conversational Follow-up UI */}
          <View style={styles.followUpSection}>
            <Text style={styles.sectionLabel}>ASK FOLLOW-UP QUESTIONS</Text>
            
            {/* Messages history logs */}
            {followUpHistory.map((msg, index) => (
              <View 
                key={index} 
                style={[
                  styles.messageBubble, 
                  msg.role === 'user' ? styles.userBubble : styles.modelBubble
                ]}
              >
                <Text 
                  style={[
                    styles.messageText, 
                    msg.role === 'user' ? styles.userMessageText : styles.modelMessageText
                  ]}
                >
                  {msg.text}
                </Text>
              </View>
            ))}

            {/* Quick chips suggested queries */}
            {followUpHistory.length === 0 && (
              <View style={styles.suggestedChipsRow}>
                {(mode === 'food' ? ["What ingredients are visible?", "Is this dish spicy?"] : ["Make this easier to understand.", "Summarize this text."]).map((prompt) => (
                  <TouchableOpacity 
                    key={prompt} 
                    style={styles.promptChip}
                    onPress={() => {
                      setFollowUpQuestion(prompt);
                    }}
                  >
                    <Text style={styles.promptChipText}>{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Input Form */}
            <View style={styles.inputFormRow}>
              <TextInput
                style={styles.followUpInput}
                placeholder="Ask about this image..."
                placeholderTextColor={colors.textSubtle}
                value={followUpQuestion}
                onChangeText={setFollowUpQuestion}
                onSubmitEditing={handleSendFollowUp}
              />
              <TouchableOpacity 
                style={[styles.sendBtn, !followUpQuestion.trim() && styles.sendBtnDisabled]}
                onPress={handleSendFollowUp}
                disabled={!followUpQuestion.trim() || followUpLoading}
              >
                {followUpLoading ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Ionicons name="arrow-up" size={18} color={colors.textInverse} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Captured Review Controls */}
      {capturedImage && cameraState === 'captured' && (
        <View style={styles.captureFooter}>
          <TouchableOpacity style={styles.galleryBtn} onPress={resetCameraSession}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
            <Text style={{ fontSize: 9, color: colors.textPrimary, marginTop: 2 }}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.analyseLaunchBtn} onPress={handleStartAnalysis}>
            <Ionicons name="sparkles-outline" size={24} color={colors.textInverse} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textInverse, marginLeft: 8 }}>Analyse Scan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Capture Controls Footer */}
      {cameraState === 'ready' && (
        <View style={styles.captureFooter}>
          <TouchableOpacity style={styles.galleryBtn} onPress={handlePickImage}>
            <Ionicons name="images-outline" size={22} color={colors.textPrimary} />
            <Text style={{ fontSize: 8, color: colors.textPrimary, marginTop: 2 }}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
            <View style={styles.captureInnerCircle} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.historyBtn} onPress={() => setHistoryVisible(true)}>
            <Ionicons name="time-outline" size={22} color={colors.textPrimary} />
            <Text style={{ fontSize: 8, color: colors.textPrimary, marginTop: 2 }}>Scans</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Searchable Language Selection Bottom Sheet */}
      <Modal
        visible={langSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setLangSheetVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Translate To</Text>
              <TouchableOpacity onPress={() => setLangSheetVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search languages..."
                placeholderTextColor={colors.textSubtle}
                value={langSearchQuery}
                onChangeText={setLangSearchQuery}
              />
            </View>
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {searchLanguages
                .filter(l => l.name.toLowerCase().includes(langSearchQuery.toLowerCase()))
                .map((l) => (
                  <TouchableOpacity 
                    key={l.code} 
                    style={styles.langRowItem}
                    onPress={() => handleSelectLanguage(l.code)}
                  >
                    <Text style={styles.langRowText}>{l.name}</Text>
                    {selectedTargetLanguage === l.code && (
                      <Ionicons name="checkmark" size={18} color={colors.accentPurple} />
                    )}
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* History Slide-up Modal */}
      <Modal
        visible={historyVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recent Camera Scans</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {loadingHistory ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
              ) : history && history.length > 0 ? (
                history.map((item) => (
                  <View key={item.id} style={styles.historyCard}>
                    <TouchableOpacity style={styles.historyCardBody} onPress={() => handleSelectHistoryItem(item)}>
                      <View style={styles.historyCardHeader}>
                        <Text style={styles.historyCardMeta}>
                          {item.operation_type?.toUpperCase() || 'SCAN'}
                        </Text>
                        <Text style={styles.historyCardTime}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                        </Text>
                      </View>
                      <Text style={styles.historySourceText} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.historyTranslatedText} numberOfLines={1}>
                        {item.translated_text || ''}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.historyCardActions}>
                      <TouchableOpacity style={styles.historyActionBtn} onPress={() => handleExportHistoryItem(item)}>
                        <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.historyActionBtn} onPress={() => handleDeleteHistoryItem(item.id)}>
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyHistoryText}>No recent scans in history.</Text>
              )}
            </ScrollView>
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
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.pageMargin,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    ...typography.heading2,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  permissionSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    height: layout.buttonHeight,
    borderRadius: layout.buttonRadius,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    width: '80%',
    ...shadows.md,
  },
  primaryBtnText: {
    ...typography.button,
    color: colors.textInverse,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.heading2,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  flashBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSoft,
    padding: 4,
    marginHorizontal: layout.pageMargin,
    marginVertical: spacing.sm,
    borderRadius: 14,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: colors.surface,
  },
  modeTabText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  modeTabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  viewfinderContainer: {
    flex: 1.5,
    marginHorizontal: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: colors.textPrimary,
    position: 'relative',
  },
  cameraView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlayFrameContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.textPrimary,
  },
  previewImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  shutterFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    zIndex: 99,
  },
  processingMask: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9, 9, 9, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginTop: spacing.md,
    fontWeight: '600',
  },
  scannerBar: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    height: 3,
    backgroundColor: '#9F55FF',
    shadowColor: '#9F55FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  scannerBarGlow: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    height: 40,
    backgroundColor: 'rgba(159, 85, 255, 0.15)',
    marginTop: -20,
    borderRadius: 8,
  },
  scannerCorners: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  webCameraContainer: {
    flex: 1,
    position: 'relative',
  },
  lensContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerBracket: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#FFFFFF',
  },
  bracketTopLeft: {
    top: '15%',
    left: '10%',
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  bracketTopRight: {
    top: '15%',
    right: '10%',
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bracketBottomLeft: {
    bottom: '15%',
    left: '10%',
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bracketBottomRight: {
    bottom: '15%',
    right: '10%',
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  focusRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  resultsSheet: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -18,
  },
  resultsSheetContent: {
    padding: layout.pageMargin,
    paddingTop: spacing.xl,
    paddingBottom: 140,
  },
  textReportCard: {
    backgroundColor: colors.surfaceSoft,
    padding: layout.cardPadding,
    borderRadius: layout.cardRadius,
    borderWidth: 0,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.smallMedium,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  ocrSourceText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
  },
  ocrTranslatedText: {
    ...typography.heading3,
    color: colors.primary,
    fontSize: 18,
    lineHeight: 24,
  },
  textArrow: {
    alignSelf: 'center',
    marginVertical: spacing.sm,
  },
  foodReportCard: {
    backgroundColor: colors.surfaceSoft,
    padding: layout.cardPadding,
    borderRadius: layout.cardRadius,
    borderWidth: 0,
    marginBottom: spacing.md,
  },
  foodReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
  },
  foodTitleRow: {
    flex: 1,
    marginRight: spacing.sm,
  },
  foodReportTitle: {
    ...typography.heading3,
    color: colors.textPrimary,
  },
  foodReportSubTitle: {
    ...typography.captionMedium,
    color: colors.textMuted,
    marginTop: 2,
  },
  matchBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success,
  },
  matchBadgeText: {
    ...typography.smallMedium,
    color: colors.success,
    fontSize: 11,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  macroItem: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroValue: {
    ...typography.heading4,
    color: colors.textPrimary,
  },
  macroLabel: {
    ...typography.smallMedium,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  allergenAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  allergenAlertText: {
    ...typography.captionMedium,
    color: colors.warning,
    marginLeft: spacing.sm,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  actionBtnOutline: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  actionBtnTextOutline: {
    ...typography.buttonSmall,
    color: colors.textPrimary,
    marginLeft: 6,
  },
  actionBtnPrimary: {
    flex: 1,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  actionBtnTextPrimary: {
    ...typography.buttonSmall,
    color: colors.textInverse,
    marginLeft: 6,
  },
  captureFooter: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
    zIndex: 99,
  },
  galleryBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  captureInnerCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
  },
  historyBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  analyseLaunchBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentPurple,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.lg,
    ...shadows.md,
  },
  followUpSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  messageBubble: {
    padding: spacing.md,
    borderRadius: 16,
    marginVertical: 4,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  modelBubble: {
    backgroundColor: colors.surfaceSoft,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 18,
  },
  userMessageText: {
    color: colors.textInverse,
  },
  modelMessageText: {
    color: colors.textPrimary,
  },
  suggestedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: spacing.md,
  },
  promptChip: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  promptChipText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  inputFormRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  followUpInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: typography.body.fontFamily,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.disabled,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalTitle: {
    ...typography.heading3,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  historyList: {
    flex: 1,
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
    marginTop: 30,
  },
  searchBarContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    alignItems: 'center',
    marginBottom: 12,
  },
  searchBarInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
  },
  langRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  langRowText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  spokenExplanationCard: {
    backgroundColor: colors.surfaceSoft || '#F4F4F5',
    borderWidth: 1,
    borderColor: colors.border || '#E4E4E7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  spokenExplanationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  spokenExplanationTitle: {
    fontSize: 11,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted || '#71717A',
    letterSpacing: 0.5,
  },
  audioControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  audioControlBtnText: {
    fontSize: 12,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '600',
  },
  spokenTranscriptText: {
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  transcriptActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  transcriptActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transcriptActionText: {
    fontSize: 12,
    fontFamily: typography.captionMedium.fontFamily,
    color: colors.textSecondary,
  },
  resultHeaderCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.backgroundSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  confidenceText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  resultSummary: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoDetailsCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  entitiesCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  entityTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  entityTag: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  entityTagText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
});
