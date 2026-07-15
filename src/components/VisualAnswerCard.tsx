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

interface VisualAnswerCardProps {
  question: string;
  answer: string;
  onCopyAnswer?: () => void;
  onSpeakAnswer?: () => void;
  style?: ViewStyle;
}

export const VisualAnswerCard: React.FC<VisualAnswerCardProps> = ({
  question,
  answer,
  onCopyAnswer,
  onSpeakAnswer,
  style,
}) => {
  const handleCopy = () => {
    triggerHaptic('success');
    if (onCopyAnswer) onCopyAnswer();
  };

  const handleSpeak = () => {
    triggerHaptic('light');
    if (onSpeakAnswer) onSpeakAnswer();
  };

  return (
    <View style={[styles.card, style]}>
      {/* Question Header */}
      <View style={styles.questionSection}>
        <Feather name="help-circle" size={14} color={colors.accentPurple} />
        <Text style={styles.questionText} numberOfLines={2}>
          {question}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Answer Body */}
      <Text style={styles.answerText}>{answer}</Text>

      {/* Footer controls */}
      <View style={styles.footerRow}>
        {onSpeakAnswer && (
          <Pressable
            onPress={handleSpeak}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityLabel="Listen to answer"
          >
            <Ionicons name="volume-medium-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.btnLabel}>Speak</Text>
          </Pressable>
        )}

        {onCopyAnswer && (
          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityLabel="Copy answer"
          >
            <Feather name="copy" size={14} color={colors.textSecondary} />
            <Text style={styles.btnLabel}>Copy</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    width: '100%',
    shadowColor: '#090909',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: spacing.md,
  },
  questionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  questionText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  answerText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSoft,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  btnLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.6,
  },
});
export default VisualAnswerCard;
