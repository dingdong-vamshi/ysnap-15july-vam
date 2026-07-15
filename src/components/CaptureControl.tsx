import React from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { CameraButton } from './CameraButton';
import { colors, spacing } from '@/constants';

interface CaptureControlProps {
  onCapture: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const CaptureControl: React.FC<CaptureControlProps> = ({
  onCapture,
  isLoading = false,
  disabled = false,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {isLoading ? (
        <View style={styles.loaderWrapper}>
          <ActivityIndicator color={colors.textInverse} size="large" />
        </View>
      ) : (
        <CameraButton
          onPress={onCapture}
          disabled={disabled || isLoading}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  loaderWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(9, 9, 9, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.textInverse,
  },
});
export default CaptureControl;
