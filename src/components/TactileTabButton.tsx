import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/constants';

export function TactileTabButton({ children, accessibilityState, onPress, onLongPress, style, href: _href, ...props }: any) {
  const press = useRef(new Animated.Value(0)).current;
  const selected = accessibilityState?.selected;

  const animate = (toValue: number) => {
    Animated.spring(press, {
      toValue,
      speed: 30,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      {...props}
      accessibilityState={accessibilityState}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      style={style}
    >
      <Animated.View
        style={[
          styles.button,
          selected && styles.selected,
          {
            transform: [
              { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) },
              { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 52,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  selected: {
    backgroundColor: colors.backgroundMuted,
    borderBottomColor: '#C8C5CE',
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
});
