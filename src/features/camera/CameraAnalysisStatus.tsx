import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import { useCameraState } from './cameraState';

const STATUS_MESSAGES = [
  'Looking at the image',
  'Reading visible text',
  'Detecting the language',
  'Identifying objects',
  'Understanding the scene',
  'Preparing your explanation',
];

export const CameraAnalysisStatus: React.FC = () => {
  const { cameraState } = useCameraState();
  const [msgIndex, setMsgIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (cameraState !== 'analysing') {
      setMsgIndex(0);
      return;
    }

    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        // Change text index
        setMsgIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [cameraState, fadeAnim]);

  if (cameraState !== 'analysing') return null;

  return (
    <View style={styles.container}>
      <View style={styles.statusBox}>
        <Animated.Text style={[styles.statusText, { opacity: fadeAnim }]}>
          {STATUS_MESSAGES[msgIndex]}
        </Animated.Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 180, // Positioned above bottom controls but below scanning box
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  statusBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
