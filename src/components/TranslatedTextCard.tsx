import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface TranslatedTextCardProps {
  text: string;
  languageName?: string;
  isBookmarked?: boolean;
  onPlaySpeech?: () => void;
  onBookmarkToggle?: () => void;
  onCopy?: () => void;
  onShare?: () => void;
  style?: ViewStyle;
}

export const TranslatedTextCard: React.FC<TranslatedTextCardProps> = ({
  text,
  languageName,
  isBookmarked = false,
  onPlaySpeech,
  onBookmarkToggle,
  onCopy,
  onShare,
  style,
}) => {
  const handlePlaySpeech = () => {
    triggerHaptic('medium');
    if (onPlaySpeech) onPlaySpeech();
  };

  const handleBookmark = () => {
    triggerHaptic('selection');
    if (onBookmarkToggle) onBookmarkToggle();
  };

  const handleCopy = () => {
    triggerHaptic('success');
    if (onCopy) onCopy();
  };

  const handleShare = () => {
    triggerHaptic('light');
    if (onShare) onShare();
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.languageLabel}>{languageName || 'Translated'}</Text>
        <View style={styles.actions}>
          {onBookmarkToggle && (
            <Pressable
              onPress={handleBookmark}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              accessibilityLabel="Bookmark translation"
            >
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isBookmarked ? colors.accentPurple : colors.textMuted}
              />
            </Pressable>
          )}
          {onCopy && (
            <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              accessibilityLabel="Copy translation"
            >
              <Feather name="copy" size={16} color={colors.textMuted} />
            </Pressable>
          )}
          {onShare && (
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              accessibilityLabel="Share translation"
            >
              <Feather name="share" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <Text style={styles.bodyText}>{text}</Text>

      {onPlaySpeech && (
        <Pressable
          onPress={handlePlaySpeech}
          style={({ pressed }) => [styles.speechBtn, pressed && styles.pressed]}
          accessibilityLabel="Listen to translated audio"
        >
          <Ionicons name="volume-high" size={20} color={colors.textInverse} />
          <Text style={styles.speechText}>Listen</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#EAF0FD',
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    borderWidth: 0,
    width: '100%',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  languageLabel: {
    ...typography.smallMedium,
    color: colors.accentBlue,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    padding: 4,
  },
  bodyText: {
    ...typography.body,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  speechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
  },
  speechText: {
    ...typography.captionMedium,
    color: colors.textInverse,
  },
  pressed: {
    opacity: 0.6,
  },
});
export default TranslatedTextCard;
