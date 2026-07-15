import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';

interface OnboardingProgressHeaderProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
}

export function OnboardingProgressHeader({
  currentStep,
  totalSteps,
  onBack,
}: OnboardingProgressHeaderProps) {
  const progressPercent = Math.min(100, Math.max(0, ((currentStep + 1) / totalSteps) * 100));

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={handleBackPress} style={styles.backButton}>
        <ArrowLeft size={20} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>
      <Text style={styles.stepText}>
        {currentStep + 1}/{totalSteps}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepText: {
    ...typography.caption,
    color: colors.textMuted,
    minWidth: 32,
    textAlign: 'right',
  },
});
