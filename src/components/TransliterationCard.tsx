import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface TransliterationCardProps {
  text: string;
  onCopy?: () => void;
  style?: ViewStyle;
}

export const TransliterationCard: React.FC<TransliterationCardProps> = ({
  text,
  onCopy,
  style,
}) => {
  const handleCopy = () => {
    triggerHaptic('success');
    if (onCopy) onCopy();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Feather name="info" size={12} color={colors.accentBlue} />
          <Text style={styles.title}>Pronunciation / Transliteration</Text>
        </View>
        {onCopy && (
          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
            accessibilityLabel="Copy pronunciation text"
          >
            <Feather name="copy" size={12} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      <Text style={styles.bodyText}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.cardRadius - 4,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  title: {
    ...typography.smallMedium,
    color: colors.textMuted,
  },
  copyBtn: {
    padding: 2,
  },
  bodyText: {
    ...typography.body,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.6,
  },
});
