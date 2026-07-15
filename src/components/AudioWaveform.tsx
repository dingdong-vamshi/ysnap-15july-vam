import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Animated,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from '@/constants';

interface AudioWaveformProps {
  isRecording?: boolean;
  progress?: number; // float 0 to 1 for playback progress
  barCount?: number;
  height?: number;
  style?: ViewStyle;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording = false,
  progress = 0,
  barCount = 28,
  height = 36,
  style,
}) => {
  // Generate random stable baseline bar heights (ratios between 0.15 and 1.0)
  const barHeights = useRef<number[]>(
    Array.from({ length: barCount }, (_, i) => {
      // Create a nice bell curve or symmetric wave shape
      const mid = barCount / 2;
      const dist = Math.abs(i - mid) / mid;
      const factor = 1 - dist * 0.7; // taper at edges
      return (0.2 + Math.random() * 0.8) * factor;
    })
  ).current;

  // Pulse animations for recording
  const recordingAnims = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(1))
  ).current;

  useEffect(() => {
    let animations: Animated.CompositeAnimation[] = [];

    if (isRecording) {
      // Set up random fluttering loops for each bar
      recordingAnims.forEach((anim) => {
        const createLoop = () => {
          const targetValue = 0.3 + Math.random() * 1.2;
          const duration = 200 + Math.random() * 400;

          return Animated.timing(anim, {
            toValue: targetValue,
            duration: duration,
            useNativeDriver: true,
          });
        };

        const loop = Animated.loop(
          Animated.sequence([createLoop(), Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true })])
        );
        animations.push(loop);
        loop.start();
      });
    } else {
      recordingAnims.forEach((anim) => {
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
      });
    }

    return () => {
      animations.forEach((a) => a.stop());
    };
  }, [isRecording, recordingAnims]);

  return (
    <View style={[styles.container, { height }, style]}>
      {barHeights.map((heightRatio, index) => {
        const activeThreshold = index / barCount;
        const isActive = progress > activeThreshold;

        // Apply animated transform scaleY for recording state
        const animatedScaleY = recordingAnims[index];

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                height: heightRatio * height,
                backgroundColor: isRecording
                  ? colors.error
                  : isActive
                  ? colors.accentPurple
                  : colors.borderStrong,
                transform: [
                  {
                    scaleY: isRecording ? animatedScaleY : 1,
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: '100%',
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    maxWidth: 6,
  },
});
export default AudioWaveform;
