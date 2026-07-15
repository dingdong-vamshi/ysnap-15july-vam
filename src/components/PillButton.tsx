import React from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface PillButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  count?: number;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

export const PillButton: React.FC<PillButtonProps> = ({
  label,
  active,
  onPress,
  icon,
  count,
  style,
  labelStyle,
}) => {
  const handlePress = () => {
    triggerHaptic('light');
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.pill,
        active ? styles.pillActive : styles.pillInactive,
        style,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label + (count !== undefined ? `, ${count} items` : '')}
    >
      <View style={styles.content}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text
          style={[
            styles.label,
            active ? styles.labelActive : styles.labelInactive,
            labelStyle,
          ]}
        >
          {label}
        </Text>
        {count !== undefined ? (
          <View
            style={[
              styles.badge,
              active ? styles.badgeActive : styles.badgeInactive,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                active ? styles.badgeTextActive : styles.badgeTextInactive,
              ]}
            >
              {count}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    borderRadius: 20,
    paddingVertical: spacing.xxs + 2,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    height: 32,
  },
  pillActive: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.surfaceSelected,
  },
  pillInactive: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  iconContainer: {
    marginRight: 2,
  },
  label: {
    ...typography.smallMedium,
  },
  labelActive: {
    color: colors.textInverse,
  },
  labelInactive: {
    color: colors.textSecondary,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  badgeInactive: {
    backgroundColor: colors.backgroundSoft,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  badgeTextActive: {
    color: colors.textInverse,
  },
  badgeTextInactive: {
    color: colors.textSecondary,
  },
});
