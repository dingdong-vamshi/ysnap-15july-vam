import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TextInputProps,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';

interface SearchInputProps extends TextInputProps {
  onClear?: () => void;
  containerStyle?: ViewStyle;
}

export const SearchInput: React.FC<SearchInputProps> = ({
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
    if (onChangeText) {
      onChangeText('');
    }
    if (onClear) {
      onClear();
    }
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
      <Feather
        name="search"
        size={18}
        color={isFocused ? colors.textPrimary : colors.textMuted}
        style={styles.searchIcon}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Search..."
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        accessibilityRole="search"
        {...props}
      />
      {hasValue ? (
        <Pressable
          onPress={handleClear}
          style={styles.clearButton}
          accessibilityLabel="Clear search input"
        >
          <Feather name="x" size={16} color={colors.textMuted} />
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
    borderRadius: 24,
    backgroundColor: colors.backgroundSoft,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  containerFocused: {
    borderColor: colors.borderFocused,
    backgroundColor: colors.surface,
  },
  searchIcon: {
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
