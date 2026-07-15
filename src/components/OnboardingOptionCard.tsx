import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';

interface OnboardingOptionCardProps {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  icon?: any;
}

export function OnboardingOptionCard({
  label,
  detail,
  selected,
  onPress,
  icon: IconComponent,
}: OnboardingOptionCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 10, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.container,
          selected && styles.containerSelected,
        ]}
      >
        {IconComponent && (
          <View style={[styles.iconWrapper, selected && styles.iconWrapperSelected]}>
            <IconComponent
              size={20}
              color={selected ? colors.textInverse : colors.primary}
            />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={[styles.label, selected && styles.labelSelected]}>
            {label}
          </Text>
          {detail && (
            <Text style={[styles.detail, selected && styles.detailSelected]}>
              {detail}
            </Text>
          )}
        </View>
        <View style={[styles.check, selected && styles.checkSelected]}>
          {selected && <Check size={12} color={colors.primary} strokeWidth={3} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  container: {
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: colors.backgroundSoft,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  containerSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconWrapperSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
  },
  labelSelected: {
    color: colors.textInverse,
  },
  detail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  detailSelected: {
    color: 'rgba(255, 255, 255, 0.65)',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    backgroundColor: colors.background,
    borderColor: colors.background,
  },
});
