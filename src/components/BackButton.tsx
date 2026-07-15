import React from 'react';
import { StyleSheet, Pressable, AccessibilityState } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, layout, spacing } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface BackButtonProps {
  onPress?: () => void;
  color?: string;
  accessibilityLabel?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  color = colors.textPrimary,
  accessibilityLabel = 'Go back',
}) => {
  const router = useRouter();

  const handlePress = () => {
    triggerHaptic('light');
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: false } as AccessibilityState}
    >
      <Feather
        name="arrow-left"
        size={20}
        color={color}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: colors.backgroundSoft,
  },
  pressed: {
    backgroundColor: colors.backgroundMuted,
    transform: [{ scale: 0.96 }],
  },
});
