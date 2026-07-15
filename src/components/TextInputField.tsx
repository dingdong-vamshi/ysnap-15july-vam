import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TextInputProps,
  Pressable,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';

interface TextInputFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  onClear?: () => void;
}

export const TextInputField: React.FC<TextInputFieldProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  onClear,
  value,
  onBlur,
  onFocus,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const hasValue = !!value && value.length > 0;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      
      <View
        style={[
          styles.container,
          isFocused && styles.containerFocused,
          !!error && styles.containerError,
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

        <TextInput
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[styles.input, inputStyle]}
          placeholderTextColor={colors.textSubtle}
          aria-invalid={!!error}
          {...props}
        />

        {onClear && hasValue ? (
          <Pressable
            onPress={onClear}
            style={styles.clearButton}
            accessibilityLabel="Clear text"
          >
            <Feather name="x-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : rightIcon ? (
          <View style={styles.rightIconContainer}>{rightIcon}</View>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: spacing.md,
  },
  label: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xxs + 2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.inputHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.inputRadius,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
  },
  containerFocused: {
    borderColor: colors.borderFocused,
    backgroundColor: colors.surface,
  },
  containerError: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  leftIconContainer: {
    marginRight: spacing.sm,
  },
  rightIconContainer: {
    marginLeft: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: 0,
    height: '100%',
  },
  clearButton: {
    padding: spacing.xxs,
    marginLeft: spacing.xxs,
  },
  errorText: {
    ...typography.small,
    color: colors.error,
    marginTop: spacing.xxs,
  },
});
