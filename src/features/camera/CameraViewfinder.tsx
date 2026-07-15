import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCameraState } from './cameraState';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

interface CameraViewfinderProps {
  onImageCaptured: (uri: string) => void;
}

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({ onImageCaptured }) => {
  const {
    cameraState,
    setCameraState,
    flashMode,
    setErrorMessage,
  } = useCameraState();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [isCapturingLocal, setIsCapturingLocal] = useState(false);

  // Synchronize state machine status based on permission
  useEffect(() => {
    if (!permission) {
      setCameraState('opening_camera');
      return;
    }

    if (!permission.granted) {
      if (permission.canAskAgain) {
        setCameraState('requesting_permission');
      } else {
        setCameraState('permission_denied');
        setErrorMessage('Camera permission was denied. Please enable it in system settings.');
      }
    } else {
      // Permission granted, wait for onCameraReady callback to set 'ready'
      setCameraState('opening_camera');
    }
  }, [permission, setCameraState, setErrorMessage]);

  const handleRequestPermission = async () => {
    try {
      await requestPermission();
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to request camera permission');
      setCameraState('permission_denied');
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || isCapturingLocal) return;

    try {
      setIsCapturingLocal(true);
      setCameraState('capturing');
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      if (photo && photo.uri) {
        onImageCaptured(photo.uri);
      } else {
        throw new Error('Camera capture returned empty result');
      }
    } catch (e: any) {
      console.error('[Native Camera] Take picture failed:', e);
      setCameraState('error');
      setErrorMessage(e.message || 'Failed to capture photo. Please try again.');
    } finally {
      setIsCapturingLocal(false);
    }
  };

  // Expose capture method globally for testing if needed
  useEffect(() => {
    (globalThis as any).__nativeCameraCapture = takePicture;
    return () => {
      delete (globalThis as any).__nativeCameraCapture;
    };
  }, [takePicture]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.fallbackContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.textSubtle} style={{ marginBottom: 16 }} />
          <Text style={styles.fallbackTitle}>Camera Access Needed</Text>
          <Text style={styles.fallbackText}>
            YSnap scans menus, products, signs, and food in real-time. Please grant camera access.
          </Text>
          {permission.canAskAgain ? (
            <Pressable style={styles.actionBtn} onPress={handleRequestPermission}>
              <Text style={styles.actionBtnText}>Grant Access</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.actionBtn} onPress={() => Linking.openSettings()}>
              <Text style={styles.actionBtnText}>Open Settings</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flashMode}
        onCameraReady={() => {
          setCameraState('ready');
        }}
        onMountError={(error) => {
          console.warn('[Native Camera] Mount error:', error);
          setCameraState('error');
          setErrorMessage('Failed to initialize hardware camera device.');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContainer: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 14,
    color: '#A9A9A9',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  actionBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 15,
  },
});
