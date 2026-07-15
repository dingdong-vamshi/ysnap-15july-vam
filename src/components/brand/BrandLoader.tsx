import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, ViewStyle } from 'react-native';
import { BrandMark } from './BrandMark';
import { colors } from '../../constants/colors';

interface BrandLoaderProps {
  size?: number;
  style?: ViewStyle;
}

export const BrandLoader: React.FC<BrandLoaderProps> = ({
  size = 64,
  style,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <BrandMark size={size} variant="transparent" />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
