import React from 'react';
import {
  StyleSheet,
  Pressable,
  Image,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface GalleryControlProps {
  onPress: () => void;
  thumbnailUri?: string | null;
  disabled?: boolean;
  style?: ViewStyle;
}

export const GalleryControl: React.FC<GalleryControlProps> = ({
  onPress,
  thumbnailUri,
  disabled = false,
  style,
}) => {
  const handlePress = () => {
    if (disabled) return;
    triggerHaptic('light');
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        shadows.md,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Open photo gallery"
    >
      {thumbnailUri ? (
        <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} />
      ) : (
        <Ionicons name="images-outline" size={20} color={colors.textInverse} />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ scale: 0.94 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
export default GalleryControl;
