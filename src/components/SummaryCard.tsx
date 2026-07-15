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

interface SummaryCardProps {
  title?: string;
  summaryText: string;
  keyPoints?: string[];
  onCopySummary?: () => void;
  style?: ViewStyle;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title = 'Conversation Summary',
  summaryText,
  keyPoints = [],
  onCopySummary,
  style,
}) => {
  const handleCopy = () => {
    triggerHaptic('success');
    if (onCopySummary) onCopySummary();
  };

  return (
    <View style={[styles.card, style]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Feather name="file-text" size={18} color={colors.accentPurple} />
          <Text style={styles.title}>{title}</Text>
        </View>
        
        {onCopySummary && (
          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
            accessibilityLabel="Copy summary to clipboard"
          >
            <Feather name="copy" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.divider} />

      {/* Main Narrative Summary */}
      <Text style={styles.summaryText}>{summaryText}</Text>

      {/* Bullet Key Points */}
      {keyPoints && keyPoints.length > 0 ? (
        <View style={styles.bulletList}>
          <Text style={styles.bulletTitle}>KEY TAKEAWAYS</Text>
          {keyPoints.map((point, index) => (
            <View key={index} style={styles.bulletRow}>
              <Ionicons
                name="ellipse"
                size={6}
                color={colors.accentPurple}
                style={styles.bulletDot}
              />
              <Text style={styles.bulletText}>{point}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  copyBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  summaryText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  bulletList: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  bulletTitle: {
    ...typography.captionMedium,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  bulletDot: {
    marginTop: 8,
  },
  bulletText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
export default SummaryCard;
