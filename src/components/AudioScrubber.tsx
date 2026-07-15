import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  PanResponder,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface AudioScrubberProps {
  progress: number; // 0 to 1
  currentTime: number; // in seconds
  duration: number; // in seconds
  onScrubStart?: () => void;
  onScrubEnd?: (progress: number) => void;
  style?: ViewStyle;
}

export const AudioScrubber: React.FC<AudioScrubberProps> = ({
  progress,
  currentTime,
  duration,
  onScrubStart,
  onScrubEnd,
  style,
}) => {
  const containerRef = useRef<View>(null);
  const containerWidth = useRef<number>(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTouch = (evt: any) => {
    if (containerWidth.current === 0 || !onScrubEnd) return;
    const { locationX } = evt.nativeEvent;
    const newProgress = Math.max(0, Math.min(1, locationX / containerWidth.current));
    onScrubEnd(newProgress);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (onScrubStart) onScrubStart();
        triggerHaptic('selection');
      },
      onPanResponderMove: (evt, gestureState) => {
        if (containerWidth.current === 0 || !onScrubEnd) return;
        // Estimate new progress based on touch position
        const deltaX = gestureState.dx;
        const startX = progress * containerWidth.current;
        const currentX = Math.max(0, Math.min(containerWidth.current, startX + deltaX));
        const newProgress = currentX / containerWidth.current;
        // Optional real-time feedback
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (containerWidth.current === 0 || !onScrubEnd) return;
        const deltaX = gestureState.dx;
        const startX = progress * containerWidth.current;
        const currentX = Math.max(0, Math.min(containerWidth.current, startX + deltaX));
        const finalProgress = currentX / containerWidth.current;
        triggerHaptic('light');
        onScrubEnd(finalProgress);
      },
    })
  ).current;

  return (
    <View style={[styles.container, style]}>
      <View
        ref={containerRef}
        onLayout={(e) => {
          containerWidth.current = e.nativeEvent.layout.width;
        }}
        style={styles.progressBarBg}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.progressBarFill,
            { width: `${progress * 100}%` },
          ]}
        />
        <View
          style={[
            styles.scrubHandle,
            { left: `${progress * 100}%` },
          ]}
        />
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: spacing.xs,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.borderStrong,
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accentPurple,
    borderRadius: 3,
  },
  scrubHandle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accentPurple,
    borderWidth: 2,
    borderColor: colors.surface,
    transform: [{ translateX: -7 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
  timeText: {
    ...typography.small,
    color: colors.textMuted,
  },
});
export default AudioScrubber;
