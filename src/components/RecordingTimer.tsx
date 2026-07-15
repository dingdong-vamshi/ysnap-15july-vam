import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/constants';

interface RecordingTimerProps {
  isRecording: boolean;
  style?: ViewStyle;
}

export const RecordingTimer: React.FC<RecordingTimerProps> = ({
  isRecording,
  style,
}) => {
  const [seconds, setSeconds] = useState(0);
  const blinkAnim = useRef(new Animated.Value(1)).current;

  // Track the actual timer ticks
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      setSeconds(0);
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setSeconds(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Handle dot blinking animation
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isRecording) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      blinkAnim.setValue(1);
    }

    return () => {
      anim?.stop();
    };
  }, [isRecording, blinkAnim]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const pad = (val: number) => val.toString().padStart(2, '0');
    return `${pad(mins)}:${pad(secs)}`;
  };

  return (
    <View style={[styles.container, style]} accessible accessibilityLabel={`Recording elapsed time: ${formatTime(seconds)}`}>
      <Animated.View
        style={[
          styles.dot,
          {
            opacity: blinkAnim,
            backgroundColor: isRecording ? colors.error : colors.textMuted,
          },
        ]}
      />
      <Text style={styles.timeText}>{formatTime(seconds)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timeText: {
    ...typography.tabular,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
export default RecordingTimer;
