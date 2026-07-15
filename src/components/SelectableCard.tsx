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

interface SelectableCardProps {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  descriptionStyle?: TextStyle;
}

export const SelectableCard: React.FC<SelectableCardProps> = ({
  title,
  description,
  selected,
  onPress,
  icon,
  style,
  titleStyle,
  descriptionStyle,
}) => {
  const handlePress = () => {
    triggerHaptic('selection');
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : styles.cardUnselected,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.contentContainer}>
        {icon && <View style={styles.iconWrapper}>{icon}</View>}

        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              selected && styles.titleSelected,
              titleStyle,
            ]}
          >
            {title}
          </Text>
          {description ? (
            <Text
              style={[
                styles.description,
                selected && styles.descriptionSelected,
                descriptionStyle,
              ]}
            >
              {description}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.indicator,
            selected ? styles.indicatorSelected : styles.indicatorUnselected,
          ]}
        >
          {selected && (
            <Feather name="check" size={12} color={colors.textInverse} />
          )}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 0,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    width: '100%',
  },
  cardSelected: {
    backgroundColor: colors.primary,
  },
  cardUnselected: {
    backgroundColor: colors.backgroundSoft,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
  },
  titleSelected: {
    color: colors.textInverse,
  },
  description: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  descriptionSelected: {
    color: 'rgba(255,255,255,0.72)',
  },
  indicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  indicatorSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  indicatorUnselected: {
    backgroundColor: 'transparent',
    borderColor: colors.borderStrong,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
