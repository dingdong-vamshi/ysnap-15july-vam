import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';

interface DataPoint {
  label: string; // e.g. "Week 1", "Week 2"
  value: number; // numeric value
}

interface SimpleLineChartProps {
  data: DataPoint[];
  title?: string;
  trendPercentage?: number; // e.g. 15 for +15%
  style?: ViewStyle;
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data,
  title = 'Performance Trend',
  trendPercentage,
  style,
}) => {
  const values = data.map((d) => d.value);
  const highest = Math.max(...values, 1);
  const lowest = Math.min(...values, 0);
  const range = highest - lowest;

  return (
    <View style={[styles.card, style]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleWrapper}>
          <Text style={styles.title}>{title}</Text>
          {trendPercentage !== undefined && (
            <View
              style={[
                styles.trendBadge,
                {
                  backgroundColor:
                    trendPercentage >= 0 ? colors.surfaceSuccess : colors.surfaceError,
                  borderColor:
                    trendPercentage >= 0
                      ? colors.accentGreen + '20'
                      : colors.error + '20',
                },
              ]}
            >
              <Feather
                name={trendPercentage >= 0 ? 'trending-up' : 'trending-down'}
                size={12}
                color={trendPercentage >= 0 ? colors.success : colors.error}
              />
              <Text
                style={[
                  styles.trendText,
                  { color: trendPercentage >= 0 ? colors.success : colors.error },
                ]}
              >
                {trendPercentage >= 0 ? '+' : ''}
                {trendPercentage}%
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Sparkline Graphic Simulation */}
      <View style={styles.chartArea}>
        <View style={styles.gridBackground}>
          {/* Horizontal lines */}
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
        </View>

        {/* Nodes and trend columns */}
        <View style={styles.nodesContainer}>
          {data.map((item, index) => {
            const percentageRatio = range > 0 ? (item.value - lowest) / range : 0.5;
            const bottomPosition = percentageRatio * 60; // scale based on container height

            return (
              <View key={index} style={styles.nodeColumn}>
                {/* Visual Dot */}
                <View
                  style={[
                    styles.nodeDot,
                    { bottom: bottomPosition },
                  ]}
                />
                
                {/* Column Stem Line */}
                <View
                  style={[
                    styles.columnStem,
                    { height: bottomPosition },
                  ]}
                />

                {/* X Axis Label */}
                <Text style={styles.axisLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trendText: {
    ...typography.smallMedium,
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  chartArea: {
    height: 100,
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  gridBackground: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    paddingVertical: 10,
    zIndex: 1,
  },
  gridLine: {
    height: 1,
    backgroundColor: colors.backgroundSoft,
    width: '100%',
  },
  nodesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    height: '100%',
    zIndex: 2,
  },
  nodeColumn: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
    height: '100%',
    justifyContent: 'flex-end',
  },
  nodeDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentPurple,
    borderWidth: 1.5,
    borderColor: colors.surface,
    zIndex: 5,
    transform: [{ translateX: 0 }, { translateY: -4 }],
  },
  columnStem: {
    width: 1,
    backgroundColor: colors.borderStrong,
    opacity: 0.6,
    marginBottom: 16,
  },
  axisLabel: {
    ...typography.small,
    fontSize: 9,
    color: colors.textMuted,
    position: 'absolute',
    bottom: 0,
  },
});
export default SimpleLineChart;
