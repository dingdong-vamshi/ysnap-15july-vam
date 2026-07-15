import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Switch,
  Platform,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface ToggleRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export const ToggleRow: React.FC<ToggleRowProps> = ({
  title,
  subtitle,
  value,
  onValueChange,
  disabled = false,
  style,
}) => {
  const handleToggle = (newValue: boolean) => {
    triggerHaptic('selection');
    onValueChange(newValue);
  };

  return (
    <View
      style={[
        styles.container,
        disabled && styles.disabled,
        style,
      ]}
      accessible
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={handleToggle}
        disabled={disabled}
        trackColor={{
          false: colors.borderStrong,
          true: colors.primary,
        }}
        thumbColor={
          Platform.OS === 'android'
            ? value
              ? colors.background
              : colors.surfaceSoft
            : undefined
        }
        ios_backgroundColor={colors.border}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSoft,
    width: '100%',
  },
  textContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  disabled: {
    opacity: 0.4,
  },
});
