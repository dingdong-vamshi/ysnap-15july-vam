import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface OriginalTextCardProps {
  text: string;
  languageName?: string;
  onPlaySpeech?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  style?: ViewStyle;
}

export const OriginalTextCard: React.FC<OriginalTextCardProps> = ({
  text,
  languageName,
  onPlaySpeech,
  onEdit,
  onCopy,
  style,
}) => {
  const handlePlaySpeech = () => {
    triggerHaptic('light');
    if (onPlaySpeech) onPlaySpeech();
  };

  const handleEdit = () => {
    triggerHaptic('light');
    if (onEdit) onEdit();
  };

  const handleCopy = () => {
    triggerHaptic('success');
    if (onCopy) onCopy();
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.languageLabel}>{languageName || 'Original'}</Text>
        <View style={styles.actions}>
          {onEdit && (
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              accessibilityLabel="Edit source text"
            >
              <Feather name="edit-2" size={16} color={colors.textMuted} />
            </Pressable>
          )}
          {onCopy && (
            <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              accessibilityLabel="Copy source text"
            >
              <Feather name="copy" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <Text style={styles.bodyText}>{text}</Text>

      {onPlaySpeech && (
        <Pressable
          onPress={handlePlaySpeech}
          style={({ pressed }) => [styles.speechBtn, pressed && styles.pressed]}
          accessibilityLabel="Listen to source audio"
        >
          <Ionicons name="volume-medium-outline" size={18} color={colors.textPrimary} />
          <Text style={styles.speechText}>Speak</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    borderWidth: 0,
    width: '100%',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  languageLabel: {
    ...typography.smallMedium,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    padding: 4,
  },
  bodyText: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  speechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
  },
  speechText: {
    ...typography.captionMedium,
    color: colors.textPrimary,
  },
  pressed: {
    opacity: 0.6,
  },
});
