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

interface SpeakerPanelProps {
  speakerALabel: string;
  speakerBLabel: string;
  activeSpeaker: 'A' | 'B' | null;
  onPressSpeaker: (speaker: 'A' | 'B') => void;
  style?: ViewStyle;
}

export const SpeakerPanel: React.FC<SpeakerPanelProps> = ({
  speakerALabel,
  speakerBLabel,
  activeSpeaker,
  onPressSpeaker,
  style,
}) => {
  const handlePress = (speaker: 'A' | 'B') => {
    triggerHaptic('medium');
    onPressSpeaker(speaker);
  };

  return (
    <View style={[styles.container, style]}>
      {/* Speaker A Section (e.g. top or left - let's make it vertical halves) */}
      <Pressable
        onPress={() => handlePress('A')}
        style={({ pressed }) => [
          styles.halfPanel,
          styles.topPanel,
          activeSpeaker === 'A' ? styles.panelActive : styles.panelInactive,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Activate microphone for ${speakerALabel}`}
      >
        <View style={[styles.content, styles.flipped]}>
          <Text style={styles.labelText}>{speakerALabel}</Text>
          <View
            style={[
              styles.micIndicator,
              activeSpeaker === 'A' ? styles.micActive : styles.micInactive,
            ]}
          >
            <Ionicons
              name={activeSpeaker === 'A' ? 'mic' : 'mic-outline'}
              size={24}
              color={activeSpeaker === 'A' ? colors.textInverse : colors.textPrimary}
            />
          </View>
          <Text style={styles.tapPrompt}>Tap to speak</Text>
        </View>
      </Pressable>

      {/* Speaker B Section */}
      <Pressable
        onPress={() => handlePress('B')}
        style={({ pressed }) => [
          styles.halfPanel,
          styles.bottomPanel,
          activeSpeaker === 'B' ? styles.panelActive : styles.panelInactive,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Activate microphone for ${speakerBLabel}`}
      >
        <View style={styles.content}>
          <Text style={styles.labelText}>{speakerBLabel}</Text>
          <View
            style={[
              styles.micIndicator,
              activeSpeaker === 'B' ? styles.micActive : styles.micInactive,
            ]}
          >
            <Ionicons
              name={activeSpeaker === 'B' ? 'mic' : 'mic-outline'}
              size={24}
              color={activeSpeaker === 'B' ? colors.textInverse : colors.textPrimary}
            />
          </View>
          <Text style={styles.tapPrompt}>Tap to speak</Text>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    gap: spacing.sm,
  },
  halfPanel: {
    flex: 1,
    borderRadius: layout.cardRadius,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topPanel: {
    // Optionally rotate the top panel so two users facing each other can read it!
  },
  flipped: {
    transform: [{ rotate: '180deg' }], // Perfect for face-to-face translation
  },
  bottomPanel: {},
  panelActive: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.accentPurple,
  },
  panelInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  labelText: {
    ...typography.heading2,
    color: colors.textPrimary,
  },
  micIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  micActive: {
    backgroundColor: colors.accentPurple,
    borderColor: colors.accentPurple,
  },
  micInactive: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.borderStrong,
  },
  tapPrompt: {
    ...typography.captionMedium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
export default SpeakerPanel;
