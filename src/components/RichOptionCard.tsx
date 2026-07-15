import React from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface RichOptionCardProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeColor?: string;
  selected?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  showArrow?: boolean;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
}

export const RichOptionCard: React.FC<RichOptionCardProps> = ({
  title,
  subtitle,
  badgeText,
  badgeColor = colors.accentPurple,
  selected = false,
  onPress,
  icon,
  showArrow = true,
  style,
  titleStyle,
  subtitleStyle,
}) => {
  const handlePress = () => {
    triggerHaptic('light');
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.selectedCard : styles.unselectedCard,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.content}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        
        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, selected && styles.titleSelected, titleStyle]} numberOfLines={1}>
              {title}
            </Text>
            {badgeText ? (
              <View style={[styles.badge, { backgroundColor: badgeColor + '15' }]}>
                <Text style={[styles.badgeText, { color: badgeColor }]}>
                  {badgeText}
                </Text>
              </View>
            ) : null}
          </View>

          {subtitle ? (
            <Text style={[styles.subtitle, selected && styles.subtitleSelected, subtitleStyle]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {showArrow && (
          <Feather
            name={selected ? 'check' : 'chevron-right'}
            size={18}
            color={selected ? colors.accentPurple : colors.textSubtle}
            style={styles.arrow}
          />
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 0,
    borderRadius: 16,
    padding: spacing.md,
    backgroundColor: colors.backgroundSoft,
    marginBottom: spacing.sm,
    width: '100%',
  },
  selectedCard: {
    backgroundColor: colors.primary,
  },
  unselectedCard: {
    backgroundColor: colors.backgroundSoft,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  title: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
  },
  titleSelected: {
    color: colors.textInverse,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  subtitleSelected: {
    color: 'rgba(255,255,255,0.72)',
  },
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    ...typography.smallMedium,
    fontSize: 10,
  },
  arrow: {
    marginLeft: spacing.xs,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
