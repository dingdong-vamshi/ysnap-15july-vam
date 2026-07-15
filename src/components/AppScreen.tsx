import React from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ViewProps,
  ScrollViewProps,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { colors, layout, spacing } from '@/constants';

interface AppScreenProps extends ViewProps {
  children: React.ReactNode;
  backgroundColor?: string;
  withPadding?: boolean;
}

export const SafeAreaScreen: React.FC<AppScreenProps> = ({
  children,
  backgroundColor = colors.background,
  withPadding = true,
  style,
  ...props
}) => {
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <View
        style={[
          styles.container,
          withPadding && styles.padded,
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    </SafeAreaView>
  );
};

interface KeyboardAwareScreenProps extends ScrollViewProps {
  children: React.ReactNode;
  backgroundColor?: string;
  withPadding?: boolean;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}

export const KeyboardAwareScreen: React.FC<KeyboardAwareScreenProps> = ({
  children,
  backgroundColor = colors.background,
  withPadding = true,
  contentContainerStyle,
  style,
  ...props
}) => {
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          style={[styles.scroll, style]}
          contentContainerStyle={[
            withPadding && styles.scrollPadded,
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...props}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

interface OnboardingScreenProps {
  steps: {
    key: string;
    render: () => React.ReactNode;
  }[];
  currentStepIndex: number;
  onStepChange?: (index: number) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  steps,
  currentStepIndex,
  onStepChange,
}) => {
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      x: currentStepIndex * width,
      animated: true,
    });
  }, [currentStepIndex, width]);

  return (
    <View style={styles.onboardingContainer}>
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        scrollEnabled={true}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          if (onStepChange && index !== currentStepIndex) {
            onStepChange(index);
          }
        }}
        style={styles.onboardingScroll}
      >
        {steps.map((step, idx) => (
          <View key={step.key} style={[styles.stepWrapper, { width }]}>
            {step.render()}
          </View>
        ))}
      </Animated.ScrollView>

      {/* Progress Dots Indicator */}
      <View style={styles.indicatorContainer} accessible accessibilityLabel={`Step ${currentStepIndex + 1} of ${steps.length}`}>
        {steps.map((_, idx) => {
          // Animated dot indicator using simple styling or Reanimated
          const isActive = idx === currentStepIndex;
          return (
            <View
              key={idx}
              style={[
                styles.dot,
                isActive ? styles.dotActive : styles.dotInactive,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: layout.pageMargin,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollPadded: {
    paddingHorizontal: layout.pageMargin,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  onboardingContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  onboardingScroll: {
    flex: 1,
  },
  stepWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.pageMargin,
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    gap: spacing.xs,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.borderStrong,
  },
});
