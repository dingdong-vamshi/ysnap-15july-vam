import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { LinearGradient } from 'expo-linear-gradient';

interface ReactiveVoiceOrbProps {
  isRecording: boolean;
  metering?: number;
  isPlaying: boolean;
  isProcessing: boolean;
  onPress: () => void;
  disabled?: boolean;
  baseDiameter?: number;
}

export const ReactiveVoiceOrb: React.FC<ReactiveVoiceOrbProps> = ({
  isRecording,
  metering = -60,
  isPlaying,
  isProcessing,
  onPress,
  disabled = false,
  baseDiameter = 80,
}) => {
  const [webLevel, setWebLevel] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Web Audio Analyser Fallback
  useEffect(() => {
    if (Platform.OS !== 'web' || !isRecording) {
      setWebLevel(0);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const initWebAudio = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        audioCtx = new AudioContextClass();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateLevel = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          // Normalize average frequency range (0-255) to 0.0 - 1.0 range
          const norm = Math.min(1, average / 75);
          setWebLevel(norm);

          animationFrameId = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (err) {
        console.warn('Web Audio initialization failed:', err);
      }
    };

    initWebAudio();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close();
      }
    };
  }, [isRecording]);

  // Determine actual normalized sound level (0.0 to 1.0)
  const getNormalizedLevel = () => {
    if (Platform.OS === 'web') {
      return webLevel;
    }
    // Decibels range from approx -60 (silence) to 0 (max volume)
    const db = metering ?? -60;
    return Math.max(0, Math.min(1, (db + 60) / 60));
  };

  const level = getNormalizedLevel();

  // Handle scaling based on voice volume level
  useEffect(() => {
    if (isRecording) {
      // Linear scaling translation: 1.0 (silence) to 1.7 (max speech volume)
      const targetScale = 1.0 + level * 0.7;
      Animated.spring(scaleAnim, {
        toValue: targetScale,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }).start();
    }
  }, [level, isRecording]);

  // Processing rotation / pulse animation
  useEffect(() => {
    if (isProcessing) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isProcessing]);

  // Playback pulse indicator
  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlaying]);

  // Accessibility Announcements
  useEffect(() => {
    if (isRecording) {
      AccessibilityInfo.announceForAccessibility('Voice recording active, listening...');
    } else if (isProcessing) {
      AccessibilityInfo.announceForAccessibility('Translating and processing speech...');
    }
  }, [isRecording, isProcessing]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const animatedOrbStyles = {
    width: baseDiameter,
    height: baseDiameter,
    borderRadius: baseDiameter / 2,
    transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
    shadowColor: isRecording ? '#7C6CD0' : isProcessing ? '#7C6CD0' : isPlaying ? '#5B8DEF' : '#000000',
    shadowOpacity: isRecording || isProcessing || isPlaying ? 0.6 : 0.25,
    shadowRadius: isRecording || isProcessing || isPlaying ? 16 : 8,
  };

  return (
    <View style={styles.container}>
      {/* Outer Halo Rings */}
      {isRecording && (
        <View style={[styles.halo, { width: baseDiameter * 1.5, height: baseDiameter * 1.5, borderRadius: (baseDiameter * 1.5) / 2 }]} />
      )}

      <Pressable
        onPress={onPress}
        disabled={disabled || isProcessing}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel={
          isRecording 
            ? "Stop translation recording" 
            : isPlaying 
              ? "Pause audio translation playback" 
              : "Start voice translation recording"
        }
      >
        <Animated.View style={[styles.orbCore, animatedOrbStyles]}>
          {/* Siri-style linear gradient background */}
          <LinearGradient
            colors={
              isRecording 
                ? ['#7C6CD0', '#5B8DEF', '#D95C67'] // Siri: Purple, Blue, Coral
                : isProcessing
                ? ['#201820', '#7C6CD0'] // Processing: Plum, Purple
                : isPlaying
                ? ['#5B8DEF', '#7C6CD0'] // Playback: Blue, Purple
                : ['#201820', '#302530'] // Idle: Plum-Black
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          
          {/* Inner Highlights */}
          <View style={styles.innerHighlight} />
          
          {/* Icons depending on states */}
          {isProcessing ? (
            <Animated.View style={{ transform: [{ rotate: rotation }] }}>
              <Ionicons name="sync" size={30} color="#FFFFFF" />
            </Animated.View>
          ) : isRecording ? (
            <Ionicons name="stop" size={30} color="#FFFFFF" />
          ) : isPlaying ? (
            <Ionicons name="volume-high" size={30} color="#FFFFFF" />
          ) : (
            <Ionicons name="mic" size={32} color="#FFFFFF" />
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    height: 160,
    width: 160,
  },
  pressable: {
    zIndex: 2,
  },
  orbCore: {
    backgroundColor: '#201820',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  halo: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    zIndex: 1,
  },
});
