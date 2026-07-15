import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/constants';

interface SpeakerBadgeProps {
  speakerId: string;
  name: string;
  style?: ViewStyle;
}

export const SpeakerBadge: React.FC<SpeakerBadgeProps> = ({
  speakerId,
  name,
  style,
}) => {
  // Return speaker colors based on ID to differentiate speakers
  const getSpeakerStyles = () => {
    switch (speakerId.toLowerCase()) {
      case 'speaker_a':
      case 'speaker1':
      case 'a':
        return {
          bg: colors.accentBlue + '15',
          text: colors.accentBlue,
        };
      case 'speaker_b':
      case 'speaker2':
      case 'b':
        return {
          bg: colors.accentPurple + '15',
          text: colors.accentPurple,
        };
      default:
        return {
          bg: colors.backgroundMuted,
          text: colors.textSecondary,
        };
    }
  };

  const currentStyles = getSpeakerStyles();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: currentStyles.bg },
        style,
      ]}
      accessible
      accessibilityLabel={`Speaker: ${name}`}
    >
      <Text style={[styles.text, { color: currentStyles.text }]}>
        {name}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.smallMedium,
    textTransform: 'capitalize',
  },
});
export default SpeakerBadge;
