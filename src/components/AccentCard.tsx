import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ViewStyle,
} from 'react-native';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface AccentCardProps {
  regionCode: string; // e.g. "US", "UK", "AU"
  label: string; // e.g. "American Accent"
  exampleText?: string; // e.g. "color vs colour"
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export const AccentCard: React.FC<AccentCardProps> = ({
  regionCode,
  label,
  exampleText,
  selected,
  onPress,
  style,
}) => {
  const handlePress = () => {
    triggerHaptic('selection');
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : styles.cardUnselected,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.flagBadge,
            selected ? styles.flagSelected : styles.flagUnselected,
          ]}
        >
          <Text
            style={[
              styles.flagText,
              selected ? styles.flagTextSelected : styles.flagTextUnselected,
            ]}
          >
            {regionCode.toUpperCase()}
          </Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.label}>{label}</Text>
          {exampleText && <Text style={styles.example}>{exampleText}</Text>}
        </View>

        <View
          style={[
            styles.radioCircle,
            selected ? styles.radioSelected : styles.radioUnselected,
          ]}
        >
          {selected && <View style={styles.radioInner} />}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
    width: '100%',
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSoft,
  },
  cardUnselected: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flagBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  flagSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  flagUnselected: {
    backgroundColor: colors.backgroundMuted,
    borderColor: colors.borderStrong,
  },
  flagText: {
    ...typography.smallMedium,
    fontWeight: '700',
    fontSize: 12,
  },
  flagTextSelected: {
    color: colors.textInverse,
  },
  flagTextUnselected: {
    color: colors.textSecondary,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
  },
  example: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 1,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioUnselected: {
    borderColor: colors.borderStrong,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
export default AccentCard;
