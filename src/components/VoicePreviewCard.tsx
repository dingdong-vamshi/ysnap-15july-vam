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

interface VoicePreviewCardProps {
  voiceName: string;
  accentText?: string;
  isPlaying: boolean;
  onPlayToggle: () => void;
  style?: ViewStyle;
}

export const VoicePreviewCard: React.FC<VoicePreviewCardProps> = ({
  voiceName,
  accentText,
  isPlaying,
  onPlayToggle,
  style,
}) => {
  const handleToggle = () => {
    triggerHaptic('light');
    onPlayToggle();
  };

  return (
    <View style={[styles.card, style]}>
      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => [
          styles.playBtn,
          isPlaying ? styles.playBtnActive : styles.playBtnInactive,
          pressed && styles.pressed,
        ]}
        accessibilityLabel={isPlaying ? 'Pause preview' : 'Play preview'}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={18}
          color={isPlaying ? colors.textInverse : colors.textPrimary}
        />
      </Pressable>

      <View style={styles.details}>
        <Text style={styles.title} numberOfLines={1}>
          Preview: {voiceName}
        </Text>
        {accentText && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {accentText}
          </Text>
        )}
      </View>

      {isPlaying && (
        <View style={styles.playingIndicator}>
          <Text style={styles.playingText}>Playing Sample...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 14,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  playBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  playBtnInactive: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
  },
  details: {
    flex: 1,
  },
  title: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  playingIndicator: {
    backgroundColor: colors.surfaceSelected + '15',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: 6,
  },
  playingText: {
    ...typography.smallMedium,
    fontSize: 10,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
export default VoicePreviewCard;
