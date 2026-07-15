import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Pressable,
  Animated,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, shadows, spacing } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface MicrophoneButtonProps {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  style?: ViewStyle;
}

export const MicrophoneButton: React.FC<MicrophoneButtonProps> = ({
  isRecording,
  onPress,
  disabled = false,
  size = 72,
  style,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isRecording) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (animation) animation.stop();
    };
  }, [isRecording, pulseAnim]);

  const handlePress = () => {
    if (disabled) return;
    if (isRecording) {
      triggerHaptic('success');
    } else {
      triggerHaptic('heavy');
    }
    onPress();
  };

  const borderRadius = size / 2;
  const innerSize = size - 12;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        { width: size, height: size, borderRadius },
        isRecording && styles.containerRecording,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={isRecording ? 'Stop voice recording' : 'Start voice recording'}
      accessibilityState={{ checked: isRecording, disabled }}
    >
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            transform: [{ scale: pulseAnim }],
            backgroundColor: isRecording ? 'rgba(193, 62, 76, 0.15)' : 'rgba(124, 108, 208, 0.15)',
          },
        ]}
      />
      <Animated.View
        style={[
          styles.buttonCore,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: isRecording ? colors.error : colors.accentPurple,
          },
          shadows.md,
        ]}
      >
        <Feather
          name={isRecording ? 'square' : 'mic'}
          size={isRecording ? 20 : 28}
          color={colors.textInverse}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  containerRecording: {
    // optional active border/overlay
  },
  pulseRing: {
    position: 'absolute',
    alignSelf: 'center',
  },
  buttonCore: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
