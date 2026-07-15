import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface CameraQuestionBarProps {
  onSubmit: (question: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export const CameraQuestionBar: React.FC<CameraQuestionBarProps> = ({
  onSubmit,
  placeholder = 'Ask a question about this image...',
  disabled = false,
  style,
}) => {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = () => {
    if (text.trim().length === 0 || disabled) return;
    triggerHaptic('medium');
    onSubmit(text.trim());
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
      style={[styles.container, style]}
    >
      <View
        style={[
          styles.bar,
          isFocused && styles.barFocused,
          disabled && styles.disabled,
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          style={styles.input}
          editable={!disabled}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
        />

        <Pressable
          onPress={handleSubmit}
          disabled={disabled || text.trim().length === 0}
          style={({ pressed }) => [
            styles.sendBtn,
            pressed && styles.pressed,
            text.trim().length > 0 && styles.sendBtnActive,
          ]}
          accessibilityLabel="Submit question"
        >
          <Feather
            name="arrow-up"
            size={18}
            color={text.trim().length > 0 ? colors.textPrimary : 'rgba(255, 255, 255, 0.4)'}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9, 9, 9, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 24,
    paddingLeft: spacing.md,
    paddingRight: spacing.xxs,
    height: 48,
  },
  barFocused: {
    borderColor: colors.accentPurple,
  },
  input: {
    flex: 1,
    ...typography.body,
    fontSize: 14,
    color: colors.textInverse,
    paddingVertical: 0,
    height: '100%',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sendBtnActive: {
    backgroundColor: colors.textInverse,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
export default CameraQuestionBar;
