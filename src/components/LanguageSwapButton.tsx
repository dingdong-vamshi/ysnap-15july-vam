import React, { useRef } from 'react';
import {
  StyleSheet,
  Pressable,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, spacing } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface LanguageSwapButtonProps {
  onSwap: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export const LanguageSwapButton: React.FC<LanguageSwapButtonProps> = ({
  onSwap,
  disabled = false,
  style,
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handleSwap = () => {
    if (disabled) return;
    triggerHaptic('medium');
    
    // Rotate 180 degrees
    Animated.spring(rotateAnim, {
      toValue: (rotateAnim as any)._value === 0 ? 1 : 0,
      tension: 50,
      friction: 4,
      useNativeDriver: true,
    }).start();

    onSwap();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Pressable
      onPress={handleSwap}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Swap translation languages"
    >
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Ionicons
          name="swap-horizontal"
          size={20}
          color={colors.textPrimary}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#090909',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  pressed: {
    backgroundColor: colors.backgroundSoft,
    transform: [{ scale: 0.92 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
export default LanguageSwapButton;
