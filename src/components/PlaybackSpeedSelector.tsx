import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface PlaybackSpeedSelectorProps {
  currentSpeed: number; // e.g. 1.0, 1.25, 1.5, 2.0
  onSpeedChange: (speed: number) => void;
  speeds?: number[];
  style?: ViewStyle;
}

export const PlaybackSpeedSelector: React.FC<PlaybackSpeedSelectorProps> = ({
  currentSpeed,
  onSpeedChange,
  speeds = [1.0, 1.25, 1.5, 2.0],
  style,
}) => {
  const handlePress = (speed: number) => {
    if (speed === currentSpeed) return;
    triggerHaptic('selection');
    onSpeedChange(speed);
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Speed</Text>
      <View style={styles.speedsRow}>
        {speeds.map((speed) => {
          const isActive = speed === currentSpeed;
          return (
            <Pressable
              key={speed}
              onPress={() => handlePress(speed)}
              style={({ pressed }) => [
                styles.speedPill,
                isActive ? styles.pillActive : styles.pillInactive,
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={`Playback speed ${speed}x`}
            >
              <Text
                style={[
                  styles.speedText,
                  isActive ? styles.textActive : styles.textInactive,
                ]}
              >
                {speed.toFixed(2).replace(/\.00$/, '')}x
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.captionMedium,
    color: colors.textMuted,
  },
  speedsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  speedPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 50,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.surfaceSelected,
  },
  pillInactive: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  speedText: {
    ...typography.smallMedium,
  },
  textActive: {
    color: colors.textInverse,
  },
  textInactive: {
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.8,
  },
});
export default PlaybackSpeedSelector;
