import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, Pressable, Platform } from 'react-native';
import { useCameraState } from './cameraState';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { validateImageFile } from './cameraUtils';

interface CameraViewfinderProps {
  onImageCaptured: (uri: string) => void;
}

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({ onImageCaptured }) => {
  const {
    cameraState,
    setCameraState,
    setErrorMessage,
    resetCameraSession,
  } = useCameraState();

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isStartingRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const attachStream = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        const handleMetadata = () => {
          video.play()
            .then(() => {
              if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
                setCameraState('ready');
              } else {
                const interval = setInterval(() => {
                  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
                    setCameraState('ready');
                    clearInterval(interval);
                  }
                }, 100);
                setTimeout(() => clearInterval(interval), 2000);
              }
            })
            .catch((err) => {
              console.warn('[Web Camera] play() error:', err);
              setCameraState('error');
              setErrorMessage('Browser blocked camera autoplay. Click to retry.');
            });
        };

        video.addEventListener('loadedmetadata', handleMetadata);
        if (video.readyState >= 1) {
          handleMetadata();
        }
      }
    }
  }, [setCameraState, setErrorMessage]);

  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    stopCamera();

    try {
      setCameraState('opening_camera');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      attachStream();
    } catch (err: any) {
      console.warn('[Web Camera] getUserMedia error:', err);
      setCameraState('permission_denied');
      setErrorMessage(err.message || 'Camera access denied. Please import a photo instead.');
    } finally {
      isStartingRef.current = false;
    }
  }, [setCameraState, setErrorMessage, attachStream, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Handle capture action
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    try {
      setCameraState('capturing');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            onImageCaptured(objectUrl);
          }
        }, 'image/jpeg', 0.92);
      }
    } catch (err: any) {
      console.error('[Web Camera] capture failed:', err);
      setCameraState('error');
      setErrorMessage('Frame capture failed: ' + err.message);
    }
  }, [onImageCaptured, setCameraState, setErrorMessage]);

  // Expose capture method globally on window for testing or parent communication
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__webCameraCapture = captureFrame;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__webCameraCapture;
      }
    };
  }, [captureFrame]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const validation = validateImageFile(file.size, file.type);
    if (!validation.valid) {
      setCameraState('error');
      setErrorMessage(validation.error || 'Invalid file');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    onImageCaptured(objectUrl);
  };

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleFileUpload}
        />
      )}

      {cameraState === 'permission_denied' || cameraState === 'error' ? (
        <View style={styles.fallbackContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.textSubtle} style={{ marginBottom: 16 }} />
          <Text style={styles.fallbackTitle}>Camera Access Required</Text>
          <Text style={styles.fallbackText}>
            YSnap needs your camera to scan items. You can also upload a photo from your gallery.
          </Text>
          <Pressable style={styles.uploadBtn} onPress={triggerFileUpload}>
            <Text style={styles.uploadBtnText}>Upload Photo</Text>
          </Pressable>
          <Pressable style={styles.retryBtn} onPress={startCamera}>
            <Text style={styles.retryBtnText}>Retry Camera</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.videoWrapper}>
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el) attachStream();
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              backgroundColor: '#000000',
            }}
            playsInline
            muted
          />
        </View>
      )}
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
  videoWrapper: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  fallbackContainer: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
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
  uploadBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadBtnText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 15,
  },
  retryBtn: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
