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

interface AlternativeItem {
  label: string; // e.g., "Formal", "Informal", "Synonym"
  text: string;
}

interface TranslationAlternativeCardProps {
  alternatives: AlternativeItem[];
  onSelectAlternative?: (item: AlternativeItem) => void;
  style?: ViewStyle;
}

export const TranslationAlternativeCard: React.FC<TranslationAlternativeCardProps> = ({
  alternatives,
  onSelectAlternative,
  style,
}) => {
  const handleSelect = (item: AlternativeItem) => {
    if (!onSelectAlternative) return;
    triggerHaptic('selection');
    onSelectAlternative(item);
  };

  if (!alternatives || alternatives.length === 0) return null;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.headerTitle}>Alternative translations</Text>
      
      <View style={styles.list}>
        {alternatives.map((item, index) => {
          const isInteractive = !!onSelectAlternative;
          return (
            <Pressable
              key={index}
              disabled={!isInteractive}
              onPress={() => handleSelect(item)}
              style={({ pressed }) => [
                styles.itemRow,
                index < alternatives.length - 1 && styles.borderBottom,
                pressed && isInteractive && styles.pressed,
              ]}
              accessibilityRole={isInteractive ? 'button' : 'text'}
              accessibilityLabel={`${item.label} alternative: ${item.text}`}
            >
              <View style={styles.content}>
                <View style={styles.labelContainer}>
                  <Text style={styles.label}>{item.label}</Text>
                </View>
                <Text style={styles.text}>{item.text}</Text>
              </View>
              {isInteractive && (
                <Feather name="corner-down-left" size={14} color={colors.textSubtle} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.cardRadius,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.captionMedium,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingRight: spacing.xs,
  },
  labelContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  label: {
    ...typography.smallMedium,
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  text: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  pressed: {
    backgroundColor: colors.border,
  },
});
export default TranslationAlternativeCard;
