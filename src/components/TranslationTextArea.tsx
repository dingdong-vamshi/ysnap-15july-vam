import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TextInputProps,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';

interface TranslationTextAreaProps extends TextInputProps {
  maxLength?: number;
  onClear?: () => void;
  containerStyle?: ViewStyle;
}

export const TranslationTextArea: React.FC<TranslationTextAreaProps> = ({
  maxLength = 1000,
  onClear,
  containerStyle,
  value,
  onChangeText,
  onFocus,
  onBlur,
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

  const currentLength = value?.length || 0;
  const hasValue = currentLength > 0;

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        containerStyle,
      ]}
    >
      <TextInput
        multiline
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Type text to translate..."
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        textAlignVertical="top"
        accessibilityLabel="Translation input area"
        {...props}
      />

      <View style={styles.footer}>
        {onClear && hasValue ? (
          <Pressable
            onPress={onClear}
            style={styles.clearButton}
            accessibilityLabel="Clear translation input"
          >
            <Feather name="x" size={16} color={colors.textMuted} />
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : (
          <View />
        )}

        <Text
          style={[
            styles.counter,
            currentLength >= maxLength && styles.counterLimit,
          ]}
          accessible
          accessibilityLabel={`${currentLength} of ${maxLength} characters`}
        >
          {currentLength}/{maxLength}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.backgroundSoft,
    borderRadius: 16,
    padding: spacing.md,
    minHeight: 180,
    justifyContent: 'space-between',
    width: '100%',
  },
  containerFocused: {
    borderColor: colors.borderFocused,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    ...typography.body,
    fontSize: 18,
    lineHeight: 26,
    color: colors.textPrimary,
    padding: 0,
    minHeight: 100,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSoft,
    marginTop: spacing.sm,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xxs,
  },
  clearText: {
    ...typography.captionMedium,
    color: colors.textMuted,
  },
  counter: {
    ...typography.small,
    color: colors.textSubtle,
  },
  counterLimit: {
    color: colors.error,
    fontWeight: '600',
  },
});
