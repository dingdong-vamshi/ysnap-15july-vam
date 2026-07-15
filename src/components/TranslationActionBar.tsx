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

interface TranslationActionBarProps {
  isBookmarked?: boolean;
  onCopy: () => void;
  onPlaySpeech: () => void;
  onBookmarkToggle: () => void;
  onPractice?: () => void;
  onShare?: () => void;
  style?: ViewStyle;
}

export const TranslationActionBar: React.FC<TranslationActionBarProps> = ({
  isBookmarked = false,
  onCopy,
  onPlaySpeech,
  onBookmarkToggle,
  onPractice,
  onShare,
  style,
}) => {
  const handleCopy = () => {
    triggerHaptic('success');
    onCopy();
  };

  const handlePlaySpeech = () => {
    triggerHaptic('light');
    onPlaySpeech();
  };

  const handleBookmark = () => {
    triggerHaptic('selection');
    onBookmarkToggle();
  };

  const handlePractice = () => {
    if (!onPractice) return;
    triggerHaptic('medium');
    onPractice();
  };

  const handleShare = () => {
    if (!onShare) return;
    triggerHaptic('light');
    onShare();
  };

  return (
    <View style={[styles.bar, style]}>
      <Pressable
        onPress={handlePlaySpeech}
        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        accessibilityLabel="Play audio speech"
      >
        <Ionicons name="volume-high-outline" size={20} color={colors.textPrimary} />
        <Text style={styles.actionLabel}>Listen</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable
        onPress={handleCopy}
        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        accessibilityLabel="Copy translation text"
      >
        <Feather name="copy" size={18} color={colors.textPrimary} />
        <Text style={styles.actionLabel}>Copy</Text>
      </Pressable>

      {onPractice && (
        <>
          <View style={styles.divider} />
          <Pressable
            onPress={handlePractice}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            accessibilityLabel="Open practice pronunciation screen"
          >
            <Ionicons name="mic-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.actionLabel}>Practice</Text>
          </Pressable>
        </>
      )}

      <View style={styles.divider} />

      <Pressable
        onPress={handleBookmark}
        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark translation'}
      >
        <Ionicons
          name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
          size={18}
          color={isBookmarked ? colors.accentPurple : colors.textPrimary}
        />
        <Text style={[styles.actionLabel, isBookmarked && styles.activeText]}>
          Save
        </Text>
      </Pressable>

      {onShare && (
        <>
          <View style={styles.divider} />
          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            accessibilityLabel="Share translation"
          >
            <Feather name="share-2" size={18} color={colors.textPrimary} />
            <Text style={styles.actionLabel}>Share</Text>
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
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    width: '100%',
    marginVertical: spacing.xs,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionLabel: {
    ...typography.smallMedium,
    color: colors.textSecondary,
  },
  activeText: {
    color: colors.accentPurple,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderStrong,
  },
  pressed: {
    opacity: 0.6,
  },
});
export default TranslationActionBar;
