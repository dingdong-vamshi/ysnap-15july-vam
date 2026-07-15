import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useCameraState } from './cameraState';
import { visualAnalysisService } from '../../services/visualAnalysisService';
import { elevenLabsService } from '../../services/elevenLabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';

const SUGGESTED_PROMPTS = [
  'What does this mean?',
  'Translate to Spanish',
  'What is the estimated price?',
  'List visible ingredients',
];

const CameraFollowUpNativeAudio: React.FC<{
  followUpAudioUrl: string | null;
  isPlayingLocal: boolean;
  setIsPlayingLocal: (playing: boolean) => void;
  playerRef: React.MutableRefObject<any>;
}> = ({ followUpAudioUrl, isPlayingLocal, setIsPlayingLocal, playerRef }) => {
  const player = useAudioPlayer(followUpAudioUrl || '');

  React.useEffect(() => {
    playerRef.current = player;
  }, [player]);

  React.useEffect(() => {
    if (isPlayingLocal && player) {
      if (!player.playing && player.currentTime >= player.duration - 0.2) {
        setIsPlayingLocal(false);
      }
    }
  }, [player.playing, player.currentTime, isPlayingLocal]);

  return null;
};

export const CameraFollowUp: React.FC = () => {
  const {
    cameraState,
    setCameraState,
    capturedImageBase64,
    followUpHistory,
    setFollowUpHistory,
    followUpLoading,
    setFollowUpLoading,
  } = useCameraState();

  const [input, setInput] = useState('');
  const [followUpAudioUrl, setFollowUpAudioUrl] = useState<string | null>(null);
  const [isPlayingLocal, setIsPlayingLocal] = useState(false);
  const playerRef = React.useRef<any>(null);

  if (cameraState !== 'follow_up') return null;

  const handleSend = async (textToSend: string) => {
    const question = textToSend.trim();
    if (!question || !capturedImageBase64) return;

    setInput('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowUpLoading(true);

    const userMessage = { role: 'user' as const, text: question };
    setFollowUpHistory((prev) => [...prev, userMessage]);

    try {
      // call visual-follow-up Edge Function
      const answer = await visualAnalysisService.askVisualFollowUp(
        capturedImageBase64,
        followUpHistory,
        question
      );

      const modelMessage = { role: 'model' as const, text: answer };
      setFollowUpHistory((prev) => [...prev, modelMessage]);

      // Attempt to synthesize speech for the answer
      try {
        const ttsRes = await elevenLabsService.generateSpeech(
          answer,
          '21m00Tcm4TlvDq8ikWAM',
          true
        );
        if (ttsRes && ttsRes.url) {
          setFollowUpAudioUrl(ttsRes.url);
          if (playerRef.current) {
            playerRef.current.replace({ uri: ttsRes.url });
            playerRef.current.play();
          }
          setIsPlayingLocal(true);
        }
      } catch (ttsErr) {
        console.warn('TTS synthesis failed for follow-up:', ttsErr);
      }
    } catch (err: any) {
      console.error('Follow-up error:', err);
      Alert.alert('Follow-up Error', err.message || 'Failed to get explanation.');
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handlePlayTTS = async (text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlayingLocal) {
      if (playerRef.current) {
        playerRef.current.pause();
      }
      setIsPlayingLocal(false);
      return;
    }

    try {
      setIsPlayingLocal(true);
      const ttsRes = await elevenLabsService.generateSpeech(
        text,
        '21m00Tcm4TlvDq8ikWAM',
        true
      );
      if (ttsRes && ttsRes.url) {
        setFollowUpAudioUrl(ttsRes.url);
        if (playerRef.current) {
          playerRef.current.replace({ uri: ttsRes.url });
          playerRef.current.play();
        }
      }
    } catch (err) {
      setIsPlayingLocal(false);
      console.warn(err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lens Chat</Text>
      </View>

      <FlatList
        data={followUpHistory}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.chatList}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.modelBubble]}>
              <Text style={[styles.messageText, isUser ? styles.userText : styles.modelText]}>
                {item.text}
              </Text>
              {!isUser && (
                <Pressable style={styles.speechBtn} onPress={() => handlePlayTTS(item.text)}>
                  <Ionicons
                    name={isPlayingLocal ? 'volume-mute-outline' : 'volume-medium-outline'}
                    size={16}
                    color={colors.textSecondary}
                  />
                </Pressable>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textSubtle} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Ask specific questions about this image.</Text>
            <View style={styles.suggestionsContainer}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  style={styles.suggestionChip}
                  onPress={() => handleSend(prompt)}
                >
                  <Text style={styles.suggestionChipText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
      />

      {followUpLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Gemini is typing...</Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Ask a question..."
          placeholderTextColor={colors.textSubtle}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => handleSend(input)}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={() => handleSend(input)}
          disabled={!input.trim()}
        >
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      {Platform.OS !== 'web' && (
        <CameraFollowUpNativeAudio
          followUpAudioUrl={followUpAudioUrl}
          isPlayingLocal={isPlayingLocal}
          setIsPlayingLocal={setIsPlayingLocal}
          playerRef={playerRef}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 60,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chatList: {
    padding: 16,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  modelBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  modelText: {
    color: colors.textPrimary,
  },
  speechBtn: {
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSubtle,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  suggestionChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSoft,
  },
  suggestionChipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSubtle,
  },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.textPrimary,
    marginRight: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
