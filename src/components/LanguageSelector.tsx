import React from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface LanguageSelectorProps {
  languageCode: string;
  languageName: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  languageCode,
  languageName,
  onPress,
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
        styles.container,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="combobox"
      accessibilityLabel={`Select language, currently ${languageName}`}
    >
      <Text style={styles.text} numberOfLines={1}>
        {languageName}
      </Text>
      <Feather
        name="chevron-down"
        size={14}
        color={colors.textSecondary}
        style={styles.chevron}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 40,
  },
  text: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    marginRight: spacing.xxs,
  },
  chevron: {
    marginLeft: spacing.xxs,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
