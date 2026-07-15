import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/constants';

interface LanguageBadgeProps {
  code: string; // e.g. "en", "es"
  label?: string; // e.g. "English"
  style?: ViewStyle;
}

export const LanguageBadge: React.FC<LanguageBadgeProps> = ({
  code,
  label,
  style,
}) => {
  return (
    <View style={[styles.badge, style]} accessible accessibilityLabel={`Language: ${label || code}`}>
      <Text style={styles.codeText}>{code.toUpperCase()}</Text>
      {label && <Text style={styles.labelText}>{label}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    gap: 4,
    alignSelf: 'flex-start',
  },
  codeText: {
    ...typography.smallMedium,
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  labelText: {
    ...typography.small,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
export default LanguageBadge;
