import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, layout, spacing, typography } from '@/constants';

interface WeeklyDataPoint {
  day: string; // e.g. "M", "T", "W"
  value: number; // e.g. 12
  isCurrentDay?: boolean;
}

interface WeeklyBarChartProps {
  data: WeeklyDataPoint[];
  maxValue?: number;
  title?: string;
  subtitle?: string;
  style?: ViewStyle;
}

export const WeeklyBarChart: React.FC<WeeklyBarChartProps> = ({
  data,
  maxValue,
  title = 'Weekly Activity',
  subtitle = 'Total translations count per day',
  style,
}) => {
  // Find highest value to scale bars relative to container height
  const highestValue = maxValue || Math.max(...data.map((d) => d.value), 1);
  const chartHeight = 120;

  return (
    <View style={[styles.card, style]}>
      {/* Title Header */}
      {title && (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}

      {/* Main Chart Area */}
      <View style={[styles.chartContainer, { height: chartHeight }]}>
        {data.map((item, idx) => {
          // Calculate percentage height
          const barHeightRatio = Math.max(0.05, Math.min(1, item.value / highestValue));
          const barHeight = barHeightRatio * (chartHeight - 30);

          return (
            <View key={idx} style={styles.barColumn}>
              {/* Value Indicator (Optional hover overlay style) */}
              <Text style={[
                styles.valueText,
                item.isCurrentDay && styles.valueTextActive
              ]}>
                {item.value}
              </Text>
              
              {/* Bar Fill */}
              <View
                style={[
                  styles.barFill,
                  { height: barHeight },
                  item.isCurrentDay ? styles.barActive : styles.barInactive,
                ]}
              />

              {/* Day Label */}
              <Text
                style={[
                  styles.dayLabel,
                  item.isCurrentDay && styles.dayLabelActive,
                ]}
              >
                {item.day}
              </Text>
            </View>
          );
        })}
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
  header: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    paddingBottom: spacing.xxs,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  valueText: {
    ...typography.small,
    fontSize: 9,
    color: colors.textSubtle,
  },
  valueTextActive: {
    color: colors.accentPurple,
    fontWeight: '700',
  },
  barFill: {
    width: 14,
    borderRadius: 7,
  },
  barActive: {
    backgroundColor: colors.accentPurple,
  },
  barInactive: {
    backgroundColor: colors.backgroundMuted,
  },
  dayLabel: {
    ...typography.smallMedium,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  dayLabelActive: {
    color: colors.accentPurple,
    fontWeight: '700',
  },
});
export default WeeklyBarChart;
