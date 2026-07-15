import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BrandMark } from './BrandMark';
import { BrandWordmark } from './BrandWordmark';
import { colors } from '../../constants/colors';

interface BrandLockupProps {
  size?: number;
  textColor?: string;
  variant?: 'light' | 'dark' | 'transparent';
  style?: ViewStyle;
}

export const BrandLockup: React.FC<BrandLockupProps> = ({
  size = 32,
  textColor,
  variant = 'transparent',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <BrandMark size={size} variant={variant} style={styles.mark} />
      <BrandWordmark color={textColor} size={size * 0.65} style={styles.wordmark} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mark: {
    marginRight: 8,
  },
  wordmark: {
    justifyContent: 'center',
  },
});
