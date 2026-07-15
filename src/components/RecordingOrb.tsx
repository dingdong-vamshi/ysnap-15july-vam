import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Animated,
  Easing,
  ViewStyle,
} from 'react-native';
import { colors, shadows } from '@/constants';

interface RecordingOrbProps {
  isActive: boolean;
  size?: number;
  style?: ViewStyle;
}

export const RecordingOrb: React.FC<RecordingOrbProps> = ({
  isActive,
  size = 120,
  style,
}) => {
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let anim1: Animated.CompositeAnimation | null = null;
    let anim2: Animated.CompositeAnimation | null = null;
    let anim3: Animated.CompositeAnimation | null = null;

    if (isActive) {
      anim1 = Animated.loop(
        Animated.timing(scale1, {
          toValue: 1.4,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
      anim2 = Animated.loop(
        Animated.timing(scale2, {
          toValue: 1.8,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
      anim3 = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.8,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );

      anim1.start();
      anim2.start();
      anim3.start();
    } else {
      scale1.setValue(1);
      scale2.setValue(1);
      opacity.setValue(0.4);
    }

    return () => {
      anim1?.stop();
      anim2?.stop();
      anim3?.stop();
    };
  }, [isActive, scale1, scale2, opacity]);

  const borderRadius = size / 2;

  return (
    <View style={[styles.container, { width: size * 2.2, height: size * 2.2 }, style]}>
      {/* Outer Ripple 2 */}
      {isActive && (
        <Animated.View
          style={[
            styles.ripple,
            {
              width: size,
              height: size,
              borderRadius: borderRadius,
              backgroundColor: colors.accentPurple + '15',
              transform: [{ scale: scale2 }],
            },
          ]}
        />
      )}

      {/* Outer Ripple 1 */}
      {isActive && (
        <Animated.View
          style={[
            styles.ripple,
            {
              width: size,
              height: size,
              borderRadius: borderRadius,
              backgroundColor: colors.accentPurple + '30',
              transform: [{ scale: scale1 }],
            },
          ]}
        />
      )}

      {/* Main Orb Center */}
      <Animated.View
        style={[
          styles.orbCore,
          {
            width: size,
            height: size,
            borderRadius: borderRadius,
            backgroundColor: colors.accentPurple,
            opacity: isActive ? opacity : 1,
          },
          shadows.lg,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  ripple: {
    position: 'absolute',
    alignSelf: 'center',
  },
  orbCore: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
export default RecordingOrb;
