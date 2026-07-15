import React from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, shadows, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface FloatingActionButtonProps {
  icon: React.ReactNode;
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon,
  label,
  onPress,
  disabled = false,
  style,
  labelStyle,
  accessibilityLabel,
}) => {
  const handlePress = () => {
    if (disabled) return;
    triggerHaptic('medium');
    onPress();
  };

  const isExtended = !!label;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.fab,
        isExtended ? styles.extended : styles.circular,
        shadows.lg,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label || 'Floating action button'}
      accessibilityState={{ disabled }}
    >
      <View style={styles.content}>
        {icon}
        {isExtended ? (
          <Text style={[styles.label, labelStyle]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  fab: {
    backgroundColor: colors.primary,
    position: 'absolute',
    bottom: spacing['2xl'],
    right: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  circular: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  extended: {
    height: 56,
    borderRadius: 28,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.button,
    color: colors.textInverse,
  },
  pressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
});
