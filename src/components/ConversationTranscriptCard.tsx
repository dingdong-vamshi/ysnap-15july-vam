import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  ViewStyle,
  Text,
  View,
} from 'react-native';
import { ConversationMessageBubble } from './ConversationMessageBubble';
import { colors, spacing, typography } from '@/constants';

interface TranscriptItem {
  id: string;
  speakerId: string;
  speakerName: string;
  sourceText: string;
  translatedText?: string;
  align: 'left' | 'right';
}

interface ConversationTranscriptCardProps {
  items: TranscriptItem[];
  playingAudioId?: string | null;
  onPlayAudio?: (id: string) => void;
  style?: ViewStyle;
}

export const ConversationTranscriptCard: React.FC<ConversationTranscriptCardProps> = ({
  items,
  playingAudioId,
  onPlayAudio,
  style,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto scroll to bottom when new entries are added
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [items.length]);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.container, style]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
    >
      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Transcript is empty.</Text>
          <Text style={styles.emptySubtext}>Tap mic buttons above to start talking.</Text>
        </View>
      ) : (
        items.map((item) => (
          <ConversationMessageBubble
            key={item.id}
            speakerName={item.speakerName}
            sourceText={item.sourceText}
            translatedText={item.translatedText}
            align={item.align}
            onPlayAudio={onPlayAudio ? () => onPlayAudio(item.id) : undefined}
            isPlayingAudio={item.id === playingAudioId}
          />
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingVertical: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyText: {
    ...typography.bodySemibold,
    color: colors.textMuted,
    fontSize: 16,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: 4,
  },
});
export default ConversationTranscriptCard;
