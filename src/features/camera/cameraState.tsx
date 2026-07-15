import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CameraState, CameraMode, VisualAnalysisResult } from './cameraTypes';
import { generateUUID } from '../../utils/uuid';
import { Platform } from 'react-native';

interface CameraContextProps {
  cameraState: CameraState;
  setCameraState: (state: CameraState) => void;
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
  
  capturedImageUri: string | null;
  setCapturedImageUri: (uri: string | null) => void;
  capturedImageBase64: string | null;
  setCapturedImageBase64: (base64: string | null) => void;
  
  visualResult: VisualAnalysisResult | null;
  setVisualResult: (result: VisualAnalysisResult | null) => void;
  
  spokenTranscript: string;
  setSpokenTranscript: React.Dispatch<React.SetStateAction<string>>;
  
  isPlayingLiveAudio: boolean;
  setIsPlayingLiveAudio: (playing: boolean) => void;
  
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  
  progressMessage: string;
  setProgressMessage: (msg: string) => void;
  
  followUpHistory: Array<{ role: 'user' | 'model'; text: string }>;
  setFollowUpHistory: React.Dispatch<React.SetStateAction<Array<{ role: 'user' | 'model'; text: string }>>>;
  followUpLoading: boolean;
  setFollowUpLoading: (loading: boolean) => void;
  
  flashMode: 'on' | 'off';
  setFlashMode: (mode: 'on' | 'off') => void;
  
  currentRequestId: string;
  setCurrentRequestId: (id: string) => void;
  
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  liveWsRef: React.MutableRefObject<WebSocket | null>;
  pcmPlayerRef: React.MutableRefObject<any>;
  
  resetCameraSession: () => void;
}

const CameraStateContext = createContext<CameraContextProps | undefined>(undefined);

export const CameraStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraMode, setCameraMode] = useState<CameraMode>('ocr');
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
  const [visualResult, setVisualResult] = useState<VisualAnalysisResult | null>(null);
  const [spokenTranscript, setSpokenTranscript] = useState<string>('');
  const [isPlayingLiveAudio, setIsPlayingLiveAudio] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [followUpHistory, setFollowUpHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);
  const [followUpLoading, setFollowUpLoading] = useState<boolean>(false);
  const [flashMode, setFlashMode] = useState<'on' | 'off'>('off');
  const [currentRequestId, setCurrentRequestId] = useState<string>(generateUUID());

  // References to clear on reset
  const abortControllerRef = useRef<AbortController | null>(null);
  const liveWsRef = useRef<WebSocket | null>(null);
  const pcmPlayerRef = useRef<any>(null);

  const resetCameraSession = useCallback(() => {
    // 1. Cancel active analysis HTTP request if in flight
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {}
      abortControllerRef.current = null;
    }

    // 2. Close active Gemini Live WebSocket connection
    if (liveWsRef.current) {
      try {
        liveWsRef.current.close();
      } catch (e) {}
      liveWsRef.current = null;
    }

    // 3. Stop and destroy PCM Player (web audio context)
    if (pcmPlayerRef.current) {
      try {
        pcmPlayerRef.current.stop();
      } catch (e) {}
      pcmPlayerRef.current = null;
    }

    // 4. Revoke web object URL if we created one
    if (Platform.OS === 'web' && capturedImageUri && capturedImageUri.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(capturedImageUri);
      } catch (e) {}
    }

    // 5. Reset states
    setCapturedImageUri(null);
    setCapturedImageBase64(null);
    setVisualResult(null);
    setSpokenTranscript('');
    setIsPlayingLiveAudio(false);
    setErrorMessage(null);
    setProgressMessage('');
    setFollowUpHistory([]);
    setFollowUpLoading(false);
    setCurrentRequestId(generateUUID());
    setCameraState('ready');
  }, [capturedImageUri]);

  return (
    <CameraStateContext.Provider
      value={{
        cameraState,
        setCameraState,
        cameraMode,
        setCameraMode,
        targetLanguage,
        setTargetLanguage,
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
        progressMessage,
        setProgressMessage,
        followUpHistory,
        setFollowUpHistory,
        followUpLoading,
        setFollowUpLoading,
        flashMode,
        setFlashMode,
        currentRequestId,
        setCurrentRequestId,
        abortControllerRef,
        liveWsRef,
        pcmPlayerRef,
        resetCameraSession,
      }}
    >
      {children}
    </CameraStateContext.Provider>
  );
};

export const useCameraState = () => {
  const context = useContext(CameraStateContext);
  if (!context) {
    throw new Error('useCameraState must be used within a CameraStateProvider');
  }
  return context;
};
