import React from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Text,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface CameraHeaderProps {
  onBack: () => void;
  flashMode: 'on' | 'off' | 'auto';
  onFlashToggle: () => void;
  onHelpPress?: () => void;
  style?: ViewStyle;
}

export const CameraHeader: React.FC<CameraHeaderProps> = ({
  onBack,
  flashMode,
  onFlashToggle,
  onHelpPress,
  style,
}) => {
  const handleFlash = () => {
    triggerHaptic('light');
    onFlashToggle();
  };

  const handleHelp = () => {
    if (onHelpPress) {
      triggerHaptic('light');
      onHelpPress();
    }
  };

  const getFlashIcon = () => {
    switch (flashMode) {
      case 'on':
        return 'flash';
      case 'auto':
        return 'flash-outline';
      case 'off':
      default:
        return 'flash-off';
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Back Button */}
      <Pressable
        onPress={() => {
          triggerHaptic('light');
          onBack();
        }}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color={colors.textInverse} />
      </Pressable>

      <Text style={styles.title}>Visual Scan</Text>

      {/* Action triggers */}
      <View style={styles.rightActions}>
        <Pressable
          onPress={handleFlash}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          accessibilityLabel={`Flash mode ${flashMode}. Tap to change.`}
        >
          <Ionicons name={getFlashIcon()} size={20} color={colors.textInverse} />
        </Pressable>

        {onHelpPress && (
          <Pressable
            onPress={handleHelp}
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
            accessibilityLabel="View camera help guide"
          >
            <Ionicons name="help-circle-outline" size={22} color={colors.textInverse} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    width: '100%',
    zIndex: 10,
    backgroundColor: 'rgba(9, 9, 9, 0.4)',
  },
  title: {
    ...typography.bodySemibold,
    color: colors.textInverse,
    fontSize: 16,
  },
  rightActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ scale: 0.95 }],
  },
});
export default CameraHeader;
