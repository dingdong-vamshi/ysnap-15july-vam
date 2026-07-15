import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

export type CameraMode = 'scan' | 'live' | 'nutrition' | 'object';

interface CameraModeOption {
  value: CameraMode;
  label: string;
}

interface CameraModeSelectorProps {
  currentMode: CameraMode;
  onModeChange: (mode: CameraMode) => void;
  style?: ViewStyle;
}

export const CameraModeSelector: React.FC<CameraModeSelectorProps> = ({
  currentMode,
  onModeChange,
  style,
}) => {
  const modes: CameraModeOption[] = [
    { value: 'scan', label: 'SCAN TEXT' },
    { value: 'live', label: 'LIVE AR' },
    { value: 'nutrition', label: 'NUTRITION' },
    { value: 'object', label: 'OBJECTS' },
  ];

  const handleModeChange = (mode: CameraMode) => {
    if (mode === currentMode) return;
    triggerHaptic('selection');
    onModeChange(mode);
  };

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={100}
      >
        {modes.map((mode) => {
          const isActive = mode.value === currentMode;
          return (
            <Pressable
              key={mode.value}
              onPress={() => handleModeChange(mode.value)}
              style={styles.modeItem}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.modeText,
                  isActive ? styles.modeTextActive : styles.modeTextInactive,
                ]}
              >
                {mode.label}
              </Text>
              {isActive && <View style={styles.activeDot} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    width: '100%',
    backgroundColor: 'rgba(9, 9, 9, 0.75)',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  modeItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    position: 'relative',
  },
  modeText: {
    ...typography.smallMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  modeTextActive: {
    color: colors.textInverse,
  },
  modeTextInactive: {
    color: colors.textMuted,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentPurple,
    position: 'absolute',
    bottom: 0,
  },
});
export default CameraModeSelector;
