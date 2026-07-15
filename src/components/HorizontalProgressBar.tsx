import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/constants';

interface HorizontalProgressBarProps {
  progress: number; // 0 to 1
  label?: string;
  showPercentText?: boolean;
  style?: ViewStyle;
}

export const HorizontalProgressBar: React.FC<HorizontalProgressBarProps> = ({
  progress,
  label,
  showPercentText = true,
  style,
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round(progress * 100)));

  const getProgressColor = () => {
    if (percentage > 85) return colors.error;
    if (percentage > 65) return colors.accentOrange;
    return colors.accentPurple;
  };

  return (
    <View style={[styles.container, style]}>
      {(label || showPercentText) ? (
        <View style={styles.textRow}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showPercentText && (
            <Text style={[styles.percent, { color: getProgressColor() }]}>
              {percentage}%
            </Text>
          )}
        </View>
      ) : null}

      <View style={styles.barBackground}>
        <View
          style={[
            styles.barFill,
            {
              width: `${percentage}%`,
              backgroundColor: getProgressColor(),
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: spacing.xs,
  },
  textRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  label: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  percent: {
    ...typography.captionMedium,
    fontWeight: '700',
  },
  barBackground: {
    height: 8,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
});
export default HorizontalProgressBar;
