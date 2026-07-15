import React from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Text,
  ViewStyle,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface ConversationControlBarProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  onClear: () => void;
  onGenerateSummary?: () => void;
  style?: ViewStyle;
}

export const ConversationControlBar: React.FC<ConversationControlBarProps> = ({
  isRecording,
  onToggleRecording,
  onClear,
  onGenerateSummary,
  style,
}) => {
  const handleToggle = () => {
    triggerHaptic(isRecording ? 'success' : 'heavy');
    onToggleRecording();
  };

  const handleClear = () => {
    triggerHaptic('warning');
    onClear();
  };

  const handleSummary = () => {
    if (!onGenerateSummary) return;
    triggerHaptic('medium');
    onGenerateSummary();
  };

  return (
    <View style={[styles.bar, style]}>
      {/* Reset/Clear Transcript */}
      <Pressable
        onPress={handleClear}
        style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
        accessibilityLabel="Clear conversation transcript"
      >
        <Feather name="trash-2" size={18} color={colors.error} />
        <Text style={[styles.btnText, { color: colors.error }]}>Clear</Text>
      </Pressable>

      <View style={styles.divider} />

      {/* Main Mic Session Button */}
      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => [
          styles.mainBtn,
          isRecording ? styles.mainBtnActive : styles.mainBtnInactive,
          pressed && styles.pressed,
        ]}
        accessibilityLabel={isRecording ? 'Stop active session' : 'Start active session'}
      >
        <Ionicons
          name={isRecording ? 'stop-circle' : 'play-circle'}
          size={22}
          color={isRecording ? colors.textInverse : colors.textInverse}
        />
        <Text style={styles.mainBtnText}>
          {isRecording ? 'Stop Session' : 'Start Session'}
        </Text>
      </Pressable>

      {onGenerateSummary && (
        <>
          <View style={styles.divider} />
          {/* Summarize Conversation */}
          <Pressable
            onPress={handleSummary}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityLabel="Summarize session key items"
          >
            <Feather name="file-text" size={18} color={colors.textPrimary} />
            <Text style={styles.btnText}>Summary</Text>
          </Pressable>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderFocused,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: '100%',
    shadowColor: '#090909',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginVertical: spacing.md,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
  },
  btnText: {
    ...typography.smallMedium,
    color: colors.textSecondary,
  },
  mainBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 12,
    gap: 6,
  },
  mainBtnActive: {
    backgroundColor: colors.error,
  },
  mainBtnInactive: {
    backgroundColor: colors.primary,
  },
  mainBtnText: {
    ...typography.smallMedium,
    color: colors.textInverse,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
export default ConversationControlBar;
