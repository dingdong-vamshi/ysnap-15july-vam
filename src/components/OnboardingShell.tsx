import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { colors } from '../constants/colors';
import { layout, spacing } from '../constants/spacing';

interface OnboardingShellProps {
  children: React.ReactNode;
}

export function OnboardingShell({ children }: OnboardingShellProps) {
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
