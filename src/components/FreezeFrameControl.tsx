import React from 'react';
import {
  StyleSheet,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, shadows } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface FreezeFrameControlProps {
  isFrozen: boolean;
  onToggle: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export const FreezeFrameControl: React.FC<FreezeFrameControlProps> = ({
  isFrozen,
  onToggle,
  disabled = false,
  style,
}) => {
  const handlePress = () => {
    if (disabled) return;
    triggerHaptic('selection');
    onToggle();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        isFrozen ? styles.buttonActive : styles.buttonInactive,
        shadows.md,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isFrozen }}
      accessibilityLabel={isFrozen ? 'Unfreeze viewfinder' : 'Freeze viewfinder frame'}
    >
      <Feather
        name={isFrozen ? 'unlock' : 'lock'}
        size={20}
        color={isFrozen ? colors.textPrimary : colors.textInverse}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  buttonActive: {
    backgroundColor: colors.surface,
    borderColor: colors.surface,
  },
  buttonInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
export default FreezeFrameControl;
