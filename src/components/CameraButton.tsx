import React from 'react';
import {
  StyleSheet,
  Pressable,
  View,
  ViewStyle,
} from 'react-native';
import { colors, shadows, spacing } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface CameraButtonProps {
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  style?: ViewStyle;
}

export const CameraButton: React.FC<CameraButtonProps> = ({
  onPress,
  disabled = false,
  size = 76,
  style,
}) => {
  const handlePress = () => {
    if (disabled) return;
    triggerHaptic('medium');
    onPress();
  };

  const outerRadius = size / 2;
  const innerSize = size - 12;
  const innerRadius = innerSize / 2;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outerRing,
        {
          width: size,
          height: size,
          borderRadius: outerRadius,
          borderColor: colors.textInverse,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Capture photo"
      accessibilityState={{ disabled }}
    >
      <View
        style={[
          styles.innerButton,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerRadius,
            backgroundColor: colors.textInverse,
          },
          shadows.md,
        ]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  outerRing: {
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 2,
  },
  innerButton: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.92 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
