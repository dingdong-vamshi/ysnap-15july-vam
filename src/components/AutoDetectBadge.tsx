import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants';

interface AutoDetectBadgeProps {
  detectedLanguage?: string;
  style?: ViewStyle;
}

export const AutoDetectBadge: React.FC<AutoDetectBadgeProps> = ({
  detectedLanguage,
  style,
}) => {
  return (
    <View style={[styles.badge, style]} accessible accessibilityLabel="Language auto detected">
      <Ionicons name="sparkles" size={10} color={colors.accentGreen} />
      <Text style={styles.text}>
        {detectedLanguage ? `Auto-detected (${detectedLanguage})` : 'Auto-detect'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSuccess,
    borderWidth: 1,
    borderColor: colors.accentGreen + '30',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: spacing.xs,
    gap: 4,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.smallMedium,
    color: colors.success,
  },
});
