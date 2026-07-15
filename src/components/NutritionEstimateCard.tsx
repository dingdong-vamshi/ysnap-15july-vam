import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';

interface NutritionItem {
  label: string; // e.g. "Protein", "Carbs", "Fat", "Calories"
  amount: string; // e.g. "12g", "45g", "8g", "320 kcal"
}

interface NutritionEstimateCardProps {
  foodName: string;
  nutrients: NutritionItem[];
  translatedFoodName?: string;
  style?: ViewStyle;
}

export const NutritionEstimateCard: React.FC<NutritionEstimateCardProps> = ({
  foodName,
  nutrients,
  translatedFoodName,
  style,
}) => {
  return (
    <View style={[styles.card, style]}>
      {/* Title */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="food-apple-outline" size={20} color={colors.accentGreen} />
        <View style={styles.titleContainer}>
          <Text style={styles.foodName}>{foodName}</Text>
          {translatedFoodName && (
            <Text style={styles.translatedFoodName}>({translatedFoodName})</Text>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Grid Values */}
      <View style={styles.grid}>
        {nutrients.map((item, idx) => (
          <View key={idx} style={styles.gridItem}>
            <Text style={styles.gridLabel}>{item.label}</Text>
            <Text style={styles.gridAmount}>{item.amount}</Text>
          </View>
        ))}
      </View>

      {/* Disclaimer Warning */}
      <View style={styles.warningBox}>
        <Feather name="info" size={12} color={colors.warning} />
        <Text style={styles.warningText}>
          Estimated values. Do not use for medical decisions.
        </Text>
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
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  titleContainer: {
    flex: 1,
  },
  foodName: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  translatedFoodName: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  gridItem: {
    width: '45%',
    backgroundColor: colors.backgroundSoft,
    borderRadius: 10,
    padding: spacing.sm,
    alignItems: 'center',
  },
  gridLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: 4,
  },
  gridAmount: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceWarning,
    borderWidth: 1,
    borderColor: colors.warning + '25',
    borderRadius: 8,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  warningText: {
    ...typography.small,
    color: colors.warning,
    fontSize: 11,
    flex: 1,
  },
});
export default NutritionEstimateCard;
