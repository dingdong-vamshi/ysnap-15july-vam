import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TextInputProps,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';

interface LanguageSearchInputProps extends TextInputProps {
  onClear?: () => void;
  containerStyle?: ViewStyle;
}

export const LanguageSearchInput: React.FC<LanguageSearchInputProps> = ({
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

  const handleClear = () => {
    if (onChangeText) onChangeText('');
    if (onClear) onClear();
  };

  const hasValue = !!value && value.length > 0;

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        containerStyle,
      ]}
    >
      <Ionicons
        name="globe-outline"
        size={18}
        color={isFocused ? colors.accentPurple : colors.textMuted}
        style={styles.globeIcon}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Search languages..."
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        accessibilityRole="search"
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
      {hasValue ? (
        <Pressable
          onPress={handleClear}
          style={styles.clearButton}
          accessibilityLabel="Clear language search"
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  containerFocused: {
    borderColor: colors.accentPurple,
    backgroundColor: colors.surface,
  },
  globeIcon: {
    marginRight: spacing.xs,
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
});
