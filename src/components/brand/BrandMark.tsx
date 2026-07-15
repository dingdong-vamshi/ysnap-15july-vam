import React from 'react';
import { StyleSheet, Image, View, ViewStyle, ImageStyle } from 'react-native';

interface BrandMarkProps {
  size?: number;
  variant?: 'light' | 'dark' | 'transparent';
  style?: ViewStyle;
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 40,
  variant = 'transparent',
  style,
}) => {
  const imageSource =
    variant === 'dark'
      ? require('../../../assets/brand/ysnap-mark-dark.png')
      : variant === 'light'
      ? require('../../../assets/brand/ysnap-mark-light.png')
      : require('../../../assets/brand/ysnap-mark-transparent.png');

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Image
        source={imageSource}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel="YSnap official 3D brand logo"
        accessibilityRole="image"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
