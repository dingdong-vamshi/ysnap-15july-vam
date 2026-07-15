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
import { triggerHaptic } from '@/lib/haptics';

interface SecureInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const SecureInput: React.FC<SecureInputProps> = ({
  label,
  error,
  containerStyle,
  inputStyle,
  value,
  onBlur,
  onFocus,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(true);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const toggleSecure = () => {
    triggerHaptic('light');
    setIsSecure(!isSecure);
  };

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
        <TextInput
          value={value}
          secureTextEntry={isSecure}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[styles.input, inputStyle]}
          placeholderTextColor={colors.textSubtle}
          aria-invalid={!!error}
          {...props}
        />

        <Pressable
          onPress={toggleSecure}
          style={styles.eyeButton}
          accessibilityLabel={isSecure ? 'Show password' : 'Hide password'}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !isSecure }}
        >
          <Feather
            name={isSecure ? 'eye-off' : 'eye'}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
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
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: 0,
    height: '100%',
  },
  eyeButton: {
    padding: spacing.xs,
    marginLeft: spacing.xxs,
  },
  errorText: {
    ...typography.small,
    color: colors.error,
    marginTop: spacing.xxs,
  },
});
