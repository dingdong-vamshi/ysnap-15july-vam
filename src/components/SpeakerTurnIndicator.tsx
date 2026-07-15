import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '@/constants';

interface SpeakerTurnIndicatorProps {
  speakerName: string;
  isListening: boolean;
  style?: ViewStyle;
}

export const SpeakerTurnIndicator: React.FC<SpeakerTurnIndicatorProps> = ({
  speakerName,
  isListening,
  style,
}) => {
  return (
    <View style={[styles.container, style]} accessible accessibilityLabel={`Speaker turn indicator: ${speakerName}`}>
      <View
        style={[
          styles.statusDot,
          isListening ? styles.dotListening : styles.dotIdle,
        ]}
      />
      <Text style={styles.text}>
        {isListening ? `Listening to ${speakerName}...` : `${speakerName}'s turn`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 20,
    alignSelf: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotListening: {
    backgroundColor: colors.accentPurple,
  },
  dotIdle: {
    backgroundColor: colors.textMuted,
  },
  text: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
});
export default SpeakerTurnIndicator;
