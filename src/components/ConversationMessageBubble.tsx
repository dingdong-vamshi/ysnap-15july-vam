import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface ConversationMessageBubbleProps {
  speakerName: string;
  sourceText: string;
  translatedText?: string;
  align: 'left' | 'right';
  onPlayAudio?: () => void;
  isPlayingAudio?: boolean;
  style?: ViewStyle;
}

export const ConversationMessageBubble: React.FC<ConversationMessageBubbleProps> = ({
  speakerName,
  sourceText,
  translatedText,
  align,
  onPlayAudio,
  isPlayingAudio = false,
  style,
}) => {
  const isLeft = align === 'left';

  const handlePlayAudio = () => {
    if (!onPlayAudio) return;
    triggerHaptic('light');
    onPlayAudio();
  };

  return (
    <View
      style={[
        styles.container,
        isLeft ? styles.alignLeft : styles.alignRight,
        style,
      ]}
    >
      {/* Speaker Name Tag */}
      <Text style={[styles.speakerName, isLeft ? styles.nameLeft : styles.nameRight]}>
        {speakerName}
      </Text>

      {/* Bubble Box */}
      <View
        style={[
          styles.bubble,
          isLeft ? styles.bubbleLeft : styles.bubbleRight,
        ]}
      >
        {/* Source Phrase */}
        <Text style={[styles.sourceText, isLeft ? styles.textLeft : styles.textRight]}>
          {sourceText}
        </Text>

        {translatedText ? (
          <>
            <View style={[styles.divider, isLeft ? styles.dividerLeft : styles.dividerRight]} />
            
            {/* Translated Phrase */}
            <Text style={[styles.translatedText, isLeft ? styles.textLeft : styles.textRight]}>
              {translatedText}
            </Text>
          </>
        ) : null}

        {/* Listen Icon */}
        {onPlayAudio && (
          <Pressable
            onPress={handlePlayAudio}
            style={({ pressed }) => [
              styles.audioBtn,
              isLeft ? styles.audioLeft : styles.audioRight,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Play audio voicing"
          >
            <Ionicons
              name={isPlayingAudio ? 'volume-high' : 'volume-high-outline'}
              size={18}
              color={isLeft ? colors.textPrimary : colors.textInverse}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: spacing.xs,
    maxWidth: '85%',
  },
  alignLeft: {
    alignSelf: 'flex-start',
  },
  alignRight: {
    alignSelf: 'flex-end',
  },
  speakerName: {
    ...typography.smallMedium,
    color: colors.textMuted,
    marginBottom: 4,
    fontSize: 11,
  },
  nameLeft: {
    textAlign: 'left',
    paddingLeft: spacing.xs,
  },
  nameRight: {
    textAlign: 'right',
    paddingRight: spacing.xs,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  bubbleLeft: {
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 4,
  },
  bubbleRight: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 4,
  },
  sourceText: {
    ...typography.body,
    fontSize: 15,
  },
  textLeft: {
    color: colors.textPrimary,
  },
  textRight: {
    color: colors.textInverse,
  },
  translatedText: {
    ...typography.bodySemibold,
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  dividerLeft: {
    backgroundColor: colors.border,
  },
  dividerRight: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  audioBtn: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    padding: 4,
  },
  audioLeft: {
    // left aligned audio position options
  },
  audioRight: {},
  pressed: {
    opacity: 0.6,
  },
});
export default ConversationMessageBubble;
