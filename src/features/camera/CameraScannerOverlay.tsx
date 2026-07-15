import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { useCameraState } from './cameraState';

export const CameraScannerOverlay: React.FC = () => {
  const { cameraState } = useCameraState();
  const { width, height } = useWindowDimensions();

  // Corner breathing animation values
  const breatheAnim = useRef(new Animated.Value(1)).current;
  // Scanning line animation values
  const scanAnim = useRef(new Animated.Value(0)).current;

  // Corner breathing (ready state)
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    
    if (cameraState === 'ready') {
      breatheAnim.setValue(1);
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 0.7,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      breatheAnim.setValue(1);
    }

    return () => {
      if (animation) animation.stop();
    };
  }, [cameraState, breatheAnim]);

  // Scan line animation (analysing state)
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (cameraState === 'analysing') {
      scanAnim.setValue(0);
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      scanAnim.setValue(0);
    }

    return () => {
      if (animation) animation.stop();
    };
  }, [cameraState, scanAnim]);

  // If we have results or follow-up, hide the viewfinder overlays entirely
  if (
    cameraState === 'result' ||
    cameraState === 'speaking' ||
    cameraState === 'follow_up' ||
    cameraState === 'error' ||
    cameraState === 'permission_denied'
  ) {
    return null;
  }

  // Calculate coordinates for the scanner box
  const boxWidth = Math.min(width * 0.75, 280);
  const boxHeight = boxWidth;

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, boxHeight - 2],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.overlayContainer}>
        {/* Semi-transparent backdrop outside scanning box */}
        <View style={styles.backdropRow} />
        
        <View style={[styles.boxContainer, { width: boxWidth, height: boxHeight }]}>
          {/* Breathing Corner boundaries */}
          <Animated.View style={[styles.corner, styles.topLeft, { opacity: breatheAnim }]} />
          <Animated.View style={[styles.corner, styles.topRight, { opacity: breatheAnim }]} />
          <Animated.View style={[styles.corner, styles.bottomLeft, { opacity: breatheAnim }]} />
          <Animated.View style={[styles.corner, styles.bottomRight, { opacity: breatheAnim }]} />

          {/* Vertical moving scanning line (only active when analysing) */}
          {cameraState === 'analysing' && (
            <Animated.View
              style={[
                styles.scanLine,
                {
                  width: boxWidth - 10,
                  transform: [{ translateY }],
                },
              ]}
            />
          )}
        </View>

        <View style={styles.backdropRow} />
      </View>
    </View>
  );
};

const CORNER_SIZE = 24;
const CORNER_BORDER_WIDTH = 3.5;

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropRow: {
    flex: 1,
  },
  boxContainer: {
    position: 'relative',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderLeftWidth: CORNER_BORDER_WIDTH,
    borderTopWidth: CORNER_BORDER_WIDTH,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: -2,
    right: -2,
    borderRightWidth: CORNER_BORDER_WIDTH,
    borderTopWidth: CORNER_BORDER_WIDTH,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderLeftWidth: CORNER_BORDER_WIDTH,
    borderBottomWidth: CORNER_BORDER_WIDTH,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderRightWidth: CORNER_BORDER_WIDTH,
    borderBottomWidth: CORNER_BORDER_WIDTH,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#FFFFFF',
    top: 0,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    // Add custom glow styled line on web
    ...(() => {
      try {
        return {
          boxShadow: '0 0 8px #FFFFFF',
        };
      } catch (e) {
        return {};
      }
    })(),
  },
});
