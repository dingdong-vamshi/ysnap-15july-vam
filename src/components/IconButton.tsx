import React from 'react';
import {
  StyleSheet,
  Pressable,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { colors, layout, spacing } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'normal' | 'small' | 'large';
  variant?: 'ghost' | 'filled' | 'outline';
  style?: ViewStyle;
  accessibilityLabel: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  disabled = false,
  loading = false,
  size = 'normal',
  variant = 'ghost',
  style,
  accessibilityLabel,
}) => {
  const handlePress = () => {
    if (disabled || loading) return;
    triggerHaptic('light');
    onPress();
  };

  const getDimensions = () => {
    switch (size) {
      case 'small':
        return { width: 36, height: 36, borderRadius: 18 };
      case 'large':
        return { width: 56, height: 56, borderRadius: 28 };
      case 'normal':
      default:
        return { width: 44, height: 44, borderRadius: 22 };
    }
  };

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'filled':
        return { backgroundColor: colors.backgroundSoft };
      case 'outline':
        return {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'ghost':
      default:
        return { backgroundColor: 'transparent' };
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        getDimensions(),
        getVariantStyle(),
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      {loading ? (
        <ActivityIndicator color={colors.textPrimary} size="small" />
      ) : (
        icon
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.3,
  },
});
