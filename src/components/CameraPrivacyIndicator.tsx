import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants';

interface CameraPrivacyIndicatorProps {
  style?: ViewStyle;
}

export const CameraPrivacyIndicator: React.FC<CameraPrivacyIndicatorProps> = ({
  style,
}) => {
  return (
    <View style={[styles.container, style]} accessible accessibilityLabel="Camera data processed securely">
      <Ionicons name="shield-checkmark" size={12} color="rgba(255, 255, 255, 0.6)" />
      <Text style={styles.text}>Secure processing • Local scanning active</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    backgroundColor: 'rgba(9, 9, 9, 0.6)',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    alignSelf: 'center',
  },
  text: {
    ...typography.small,
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
});
export default CameraPrivacyIndicator;
