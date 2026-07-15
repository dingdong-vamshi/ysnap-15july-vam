import React from 'react';
import { StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Languages } from 'lucide-react-native';
import { colors, layout, spacing, typography } from '../../constants';
import { PrimaryButton, SecondaryButton, TactileButton, IllustrationFrame, ResponsiveOnboardingLayout } from '../../components';
import { BrandLockup } from '../../components/brand/BrandLockup';
import { demoProfileStore } from '../../utils/tempOnboardingStore';

import { useTheme, useThemeStyles } from '../../contexts/ThemeContext';

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const { isDark } = useTheme();
  const styles = useThemeStyles(createStyles);

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(auth)/onboarding');
  };

  const handleSignIn = () => {
    Haptics.selectionAsync();
    router.push('/(auth)/sign-in');
  };

  const handleDemo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Mark onboarding completed immediately for demo mode to bypass languages/permissions
    demoProfileStore.set({ onboarding_completed: true });
    router.replace({ pathname: '/(tabs)', params: { demo: '1' } });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.container}>
        <BrandLockup size={24} style={{ marginBottom: spacing.md }} />

        <View style={styles.hero}>
          <ResponsiveOnboardingLayout>
            <IllustrationFrame imageId="IMG-001" height={isDesktop ? 460 : 240} />
            <View style={styles.contentColumn}>
              <Text style={styles.title}>Understand anyone, anywhere.</Text>
              <Text style={styles.subtitle}>
                Point, speak, or type. YSnap turns the language around you into words you understand.
              </Text>
              <View style={styles.desktopActions}>
                <PrimaryButton title="Get started" onPress={handleGetStarted} style={styles.buttonSpacing} />
                <SecondaryButton title="Demo" onPress={handleDemo} style={styles.buttonSpacing} />
                <TactileButton variant="text" title="I already have an account" onPress={handleSignIn} />
              </View>
            </View>
          </ResponsiveOnboardingLayout>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { ...typography.heading3, color: colors.textPrimary },
  hero: { flex: 1, justifyContent: 'center' },
  visual: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 28,
    padding: spacing.md,
    marginBottom: spacing['2xl'],
  },
  cameraBar: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  cameraBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLabel: { ...typography.label, color: colors.textPrimary, flex: 1, marginLeft: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  scanArea: {
    minHeight: 220,
    borderRadius: 20,
    backgroundColor: '#ECECF2',
    padding: spacing.lg,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scanIcon: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceLine: { width: '58%', height: 11, borderRadius: 6, backgroundColor: '#C8C8D0', marginBottom: 10 },
  sourceLineShort: { width: '38%', marginBottom: spacing.xl },
  resultCard: { backgroundColor: colors.background, borderRadius: 16, padding: spacing.md },
  resultMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  resultLanguage: { ...typography.micro, color: colors.accentBlue },
  resultText: { ...typography.bodyLarge, fontWeight: '600', color: colors.textPrimary },
  title: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.sm, maxWidth: 330 },
  subtitle: { ...typography.body, color: colors.textSecondary, maxWidth: 360 },
  actions: { gap: spacing.xs },
  signIn: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  signInText: { ...typography.label, color: colors.textPrimary },
  demo: { minHeight: 44, borderRadius: 22, backgroundColor: colors.backgroundSoft, alignItems: 'center', justifyContent: 'center' },
  demoText: { ...typography.label, color: colors.textPrimary },
  pressed: { opacity: 0.55 },
  contentColumn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  desktopActions: {
    width: '100%',
    maxWidth: 320,
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  buttonSpacing: {
    marginBottom: 8,
  },
});
