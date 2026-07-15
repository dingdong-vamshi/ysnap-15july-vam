import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, layout, spacing, typography } from '@/constants';

interface UsageProgressRingProps {
  progress: number; // float 0 to 1
  label?: string; // e.g. "Scans"
  usedValue: number; // e.g. 15
  limitValue: number; // e.g. 50
  style?: ViewStyle;
}

export const UsageProgressRing: React.FC<UsageProgressRingProps> = ({
  progress,
  label = 'Scans',
  usedValue,
  limitValue,
  style,
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round(progress * 100)));

  // Determine ring border color based on usage percentage
  const getRingColor = () => {
    if (percentage > 85) return colors.error;
    if (percentage > 65) return colors.accentOrange;
    return colors.accentPurple;
  };

  return (
    <View style={[styles.container, style]}>
      {/* Simulation of progress circle using nested concentric views */}
      <View style={[styles.outerRing, { borderColor: colors.border }]}>
        {/* Highlight segment */}
        <View
          style={[
            styles.indicatorSegment,
            { borderColor: getRingColor() },
          ]}
        />
        
        {/* Center label */}
        <View style={styles.centerContainer}>
          <Text style={styles.percentageText}>{percentage}%</Text>
          <Text style={styles.labelText}>{label}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.usageText}>
          {usedValue} of {limitValue} used
        </Text>
        {percentage >= 90 ? (
          <Text style={styles.alertText}>Limit almost reached</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  outerRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  indicatorSegment: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 6,
    borderColor: colors.accentPurple,
    // Simulate partial progress rotation/coverage
    opacity: 0.85,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    ...typography.display,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  labelText: {
    ...typography.captionMedium,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  details: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  usageText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  alertText: {
    ...typography.smallMedium,
    color: colors.error,
    marginTop: 4,
  },
});
export default UsageProgressRing;
