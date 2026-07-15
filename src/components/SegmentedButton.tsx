import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  useWindowDimensions,
  ViewStyle,
} from 'react-native';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface SegmentOption {
  value: string;
  label: string;
}

interface SegmentedButtonProps {
  options: SegmentOption[];
  selectedValue: string;
  onChange: (value: string) => void;
  style?: ViewStyle;
}

export const SegmentedButton: React.FC<SegmentedButtonProps> = ({
  options,
  selectedValue,
  onChange,
  style,
}) => {
  const containerWidth = useRef<number>(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const selectedIndex = options.findIndex((opt) => opt.value === selectedValue);
  const numSegments = options.length;

  useEffect(() => {
    if (containerWidth.current > 0 && selectedIndex !== -1) {
      const segmentWidth = containerWidth.current / numSegments;
      Animated.spring(slideAnim, {
        toValue: selectedIndex * segmentWidth,
        useNativeDriver: true,
        damping: 20,
        stiffness: 150,
      }).start();
    }
  }, [selectedIndex, numSegments, slideAnim]);

  const handleSelect = (value: string, index: number) => {
    if (value === selectedValue) return;
    triggerHaptic('selection');
    onChange(value);
  };

  const handleLayout = (e: any) => {
    containerWidth.current = e.nativeEvent.layout.width;
    if (selectedIndex !== -1) {
      const segmentWidth = containerWidth.current / numSegments;
      slideAnim.setValue(selectedIndex * segmentWidth);
    }
  };

  const segmentWidthPercent = 100 / numSegments;

  return (
    <View
      onLayout={handleLayout}
      style={[styles.container, style]}
    >
      {containerWidth.current > 0 && (
        <Animated.View
          style={[
            styles.slider,
            {
              width: `${segmentWidthPercent}%`,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        />
      )}
      {options.map((option, idx) => {
        const isSelected = option.value === selectedValue;
        return (
          <Pressable
            key={option.value}
            onPress={() => handleSelect(option.value, idx)}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
          >
            <Text
              style={[
                styles.segmentText,
                isSelected ? styles.segmentTextSelected : styles.segmentTextUnselected,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundMuted,
    borderRadius: 14,
    padding: 3,
    position: 'relative',
    height: 44,
    alignItems: 'center',
    width: '100%',
  },
  slider: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    backgroundColor: colors.surface,
    borderRadius: 11,
    shadowColor: '#090909',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segment: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  segmentText: {
    ...typography.captionMedium,
  },
  segmentTextSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  segmentTextUnselected: {
    color: colors.textMuted,
  },
});
