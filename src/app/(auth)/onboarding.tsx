import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  BookOpen, Briefcase, Camera, Check, Languages, MessageCircleMore,
  Mic, Plane, Volume2,
} from 'lucide-react-native';
import { colors, spacing, typography } from '../../constants';
import { PrimaryButton } from '../../components/PrimaryButton';
import { tempOnboardingStore } from '../../utils/tempOnboardingStore';
import {
  OnboardingShell,
  OnboardingProgressHeader,
  IllustrationFrame,
  OnboardingOptionCard,
  OnboardingMultiSelectCard,
  OnboardingFooter,
  ResponsiveOnboardingLayout,
} from '../../components';
import { demoProfileStore } from '../../utils/tempOnboardingStore';

const languageOptions = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Hindi'];
const goals = [
  { label: 'Travel with confidence', icon: Plane }, { label: 'Learn a language', icon: BookOpen },
  { label: 'Use it at work', icon: Briefcase }, { label: 'Connect with people', icon: MessageCircleMore },
];
const modes = [
  { label: 'Speak', detail: 'Translate your voice', icon: Mic },
  { label: 'Scan', detail: 'Read signs and menus', icon: Camera },
  { label: 'Type', detail: 'Translate any message', icon: Languages },
];

import { useTheme, useThemeStyles } from '../../contexts/ThemeContext';

export default function Onboarding() {
  const router = useRouter();
  const { isDark } = useTheme();
  const styles = useThemeStyles(createStyles);
  const [step, setStep] = useState(0);
  const [native, setNative] = useState('English');
  const [target, setTarget] = useState('Spanish');
  const [selectedGoals, setGoals] = useState<string[]>(['Travel with confidence']);
  const [level, setLevel] = useState('Just starting');
  const [mode, setMode] = useState('Speak');
  const [reminders, setReminders] = useState('Not now');
  const motion = useRef(new Animated.Value(1)).current;

  const move = (next: number) => {
    Haptics.selectionAsync();
    Animated.timing(motion, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setStep(next);
      motion.setValue(0);
      Animated.spring(motion, { toValue: 1, speed: 22, bounciness: 4, useNativeDriver: true }).start();
    });
  };

  const toggleGoal = (value: string) => {
    Haptics.selectionAsync();
    setGoals((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const renderStep = () => {
    if (step === 0) return (
      <ResponsiveOnboardingLayout>
        <IllustrationFrame imageId="IMG-001" />
        <View>
          <Text style={styles.kicker}>WELCOME TO YSNAP</Text>
          <Text style={styles.title}>Understand the world around you.</Text>
          <Text style={styles.subtitle}>Speak, scan, or type. YSnap makes everyday language feel familiar.</Text>
        </View>
      </ResponsiveOnboardingLayout>
    );

    if (step === 1) return (
      <ResponsiveOnboardingLayout>
        <IllustrationFrame imageId="IMG-009" />
        <View>
          <Text style={styles.kicker}>TRY IT FIRST</Text>
          <Text style={styles.title}>Your first translation, already done.</Text>
          <Text style={styles.subtitle}>Tap the result to hear how it sounds.</Text>
          
          <Pressable 
            style={({ pressed }) => [styles.demoCard, pressed && styles.pressed]} 
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <Text style={styles.demoLabel}>FRENCH → ENGLISH</Text>
            <Text style={styles.demoSource}>Un café, s’il vous plaît.</Text>
            <View style={styles.demoResult}>
              <Volume2 size={20} color={colors.textInverse} />
              <Text style={styles.demoResultText}>A coffee, please.</Text>
            </View>
          </Pressable>
        </View>
      </ResponsiveOnboardingLayout>
    );

    if (step === 2 || step === 3) {
      const isNative = step === 2;
      const value = isNative ? native : target;
      const setValue = isNative ? setNative : setTarget;
      return (
        <ResponsiveOnboardingLayout>
          <IllustrationFrame imageId={isNative ? "IMG-013" : "IMG-016"} />
          <View>
            <Text style={styles.kicker}>MAKE IT YOURS</Text>
            <Text style={styles.title}>{isNative ? 'What language feels most natural?' : 'What would you like to learn?'}</Text>
            <Text style={styles.subtitle}>{isNative ? 'YSnap will use this for explanations and controls.' : 'You can add or switch languages anytime.'}</Text>
            <View style={styles.optionList}>
              {languageOptions.map((item) => (
                <OnboardingOptionCard
                  key={item}
                  label={item}
                  selected={value === item}
                  onPress={() => setValue(item)}
                />
              ))}
            </View>
          </View>
        </ResponsiveOnboardingLayout>
      );
    }

    if (step === 4) return (
      <ResponsiveOnboardingLayout>
        <IllustrationFrame imageId="IMG-007" />
        <View>
          <Text style={styles.kicker}>YOUR GOALS</Text>
          <Text style={styles.title}>What should YSnap help with?</Text>
          <Text style={styles.subtitle}>Choose as many as you like.</Text>
          <View style={styles.optionList}>
            {goals.map((item) => (
              <OnboardingMultiSelectCard
                key={item.label}
                label={item.label}
                icon={item.icon}
                selected={selectedGoals.includes(item.label)}
                onPress={() => toggleGoal(item.label)}
              />
            ))}
          </View>
        </View>
      </ResponsiveOnboardingLayout>
    );

    if (step === 5) return (
      <ResponsiveOnboardingLayout>
        <IllustrationFrame imageId="IMG-014" />
        <View>
          <Text style={styles.kicker}>YOUR PACE</Text>
          <Text style={styles.title}>Where are you starting from?</Text>
          <Text style={styles.subtitle}>There’s no test. This only adjusts practice difficulty.</Text>
          <View style={styles.optionList}>
            {['Just starting', 'Know a few phrases', 'Can hold a conversation'].map((item) => (
              <OnboardingOptionCard
                key={item}
                label={item}
                selected={level === item}
                onPress={() => setLevel(item)}
              />
            ))}
          </View>
        </View>
      </ResponsiveOnboardingLayout>
    );

    if (step === 6) return (
      <ResponsiveOnboardingLayout>
        <IllustrationFrame imageId="IMG-005" />
        <View>
          <Text style={styles.kicker}>YOUR SHORTCUT</Text>
          <Text style={styles.title}>How do you want to translate first?</Text>
          <Text style={styles.subtitle}>Your favorite tool will be waiting on Home.</Text>
          <View style={styles.optionList}>
            {modes.map((item) => (
              <OnboardingOptionCard
                key={item.label}
                label={item.label}
                detail={item.detail}
                icon={item.icon}
                selected={mode === item.label}
                onPress={() => setMode(item.label)}
              />
            ))}
          </View>
        </View>
      </ResponsiveOnboardingLayout>
    );

    if (step === 7) return (
      <ResponsiveOnboardingLayout>
        <IllustrationFrame imageId="IMG-010" />
        <View>
          <Text style={styles.kicker}>PRIVACY & CONTROLS</Text>
          <Text style={styles.title}>You’re always in control.</Text>
          <Text style={styles.subtitle}>YSnap asks for camera or microphone access only when you choose those tools. You can change access anytime in Settings.</Text>
          <View style={styles.privacyCard}>
            <Text style={styles.privacyTitle}>Practice reminders</Text>
            <Text style={styles.privacyText}>Would a gentle daily reminder help you keep learning?</Text>
            <View style={styles.choiceRow}>
              {['Yes, remind me', 'Not now'].map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setReminders(item);
                  }}
                  style={[styles.choice, reminders === item && styles.choiceSelected]}
                >
                  <Text style={[styles.choiceText, reminders === item && styles.choiceTextSelected]}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Text style={styles.caption}>No notification permission is requested on this screen.</Text>
        </View>
      </ResponsiveOnboardingLayout>
    );

    return (
      <ResponsiveOnboardingLayout>
        <IllustrationFrame imageId="IMG-002" />
        <View>
          <Text style={styles.kicker}>READY TO GO</Text>
          <Text style={styles.title}>Your YSnap is ready.</Text>
          <Text style={styles.subtitle}>Built around {target}, {selectedGoals[0]?.toLowerCase() || 'everyday communication'}, and the way you like to {mode.toLowerCase()}.</Text>
          <View style={styles.planCard}>
            <Text style={styles.planEyebrow}>YOUR STARTING PLAN</Text>
            <Text style={styles.planTitle}>{native} → {target}</Text>
            {['Quick daily speaking practice', `${mode} available from Home`, reminders === 'Yes, remind me' ? 'Reminder ready to enable later' : 'No reminders'].map((item) => (
              <View key={item} style={styles.planRow}>
                <Check size={16} color={colors.success} />
                <Text style={styles.planText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ResponsiveOnboardingLayout>
    );
  };

  const handleFinish = () => {
    // Map goals and language values to codes
    const goalMap: Record<string, string> = {
      'Travel with confidence': 'travel',
      'Learn a language': 'study',
      'Use it at work': 'business',
      'Connect with people': 'social',
    };
    const langMap: Record<string, string> = {
      'English': 'en',
      'Spanish': 'es',
      'French': 'fr',
      'German': 'de',
      'Japanese': 'ja',
      'Hindi': 'hi',
    };

    const nativeCode = langMap[native] ?? 'en';
    const targetCode = langMap[target] ?? 'es';
    const purposeCode = goalMap[selectedGoals[0]] ?? 'travel';

    tempOnboardingStore.set({
      native: nativeCode,
      target: targetCode,
      purpose: purposeCode,
      selected_goals: selectedGoals,
      experience_level: level,
      preferred_mode: mode.toLowerCase(),
      reminder_enabled: reminders === 'Yes, remind me',
    });

    router.push('/(auth)/sign-up');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OnboardingProgressHeader
        currentStep={step}
        totalSteps={9}
        onBack={() => step ? move(step - 1) : router.replace('/(auth)/welcome')}
      />
      <OnboardingShell>
        <Animated.View style={{ flex: 1, opacity: motion, transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
          {renderStep()}
        </Animated.View>
      </OnboardingShell>
      <OnboardingFooter>
        <PrimaryButton
          title={step === 8 ? 'Create my account' : 'Continue'}
          onPress={() => step === 8 ? handleFinish() : move(step + 1)}
          disabled={step === 4 && !selectedGoals.length}
        />
        {step === 0 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              demoProfileStore.set({ onboarding_completed: true });
              router.replace({ pathname: '/(tabs)', params: { demo: '1' } });
            }}
            style={styles.signIn}
          >
            <Text style={styles.signInText}>Demo</Text>
          </Pressable>
        )}
        {step === 8 && (
          <Pressable
            onPress={() => router.push('/(auth)/sign-in')}
            style={styles.signIn}
          >
            <Text style={styles.signInText}>I already have an account</Text>
          </Pressable>
        )}
      </OnboardingFooter>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  kicker: { ...typography.micro, color: colors.textMuted, marginBottom: spacing.sm },
  title: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.sm, maxWidth: 360 },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl, maxWidth: 390 },
  demoCard: { backgroundColor: colors.backgroundSoft, borderRadius: 24, padding: spacing.lg, marginTop: spacing.xl },
  demoLabel: { ...typography.micro, color: colors.textMuted, marginBottom: spacing.sm },
  demoSource: { ...typography.heading2, color: colors.textPrimary, marginBottom: spacing.xl },
  demoResult: { backgroundColor: colors.primary, borderRadius: 16, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  demoResultText: { ...typography.bodyLarge, fontWeight: '600', color: colors.textInverse },
  optionList: { gap: spacing.sm },
  privacyCard: { backgroundColor: colors.backgroundSoft, borderRadius: 20, padding: spacing.lg, marginTop: spacing.md },
  privacyTitle: { ...typography.heading3, color: colors.textPrimary }, privacyText: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 5, marginBottom: spacing.md },
  choiceRow: { flexDirection: 'row', gap: spacing.xs }, choice: { flex: 1, borderRadius: 14, backgroundColor: colors.background, padding: spacing.sm, alignItems: 'center' },
  choiceSelected: { backgroundColor: colors.primary }, choiceText: { ...typography.label, color: colors.textPrimary }, choiceTextSelected: { color: colors.textInverse },
  caption: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  planCard: { backgroundColor: colors.backgroundSoft, borderRadius: 24, padding: spacing.lg, marginTop: spacing.md },
  planEyebrow: { ...typography.micro, color: colors.textMuted }, planTitle: { ...typography.heading2, color: colors.textPrimary, marginTop: 5, marginBottom: spacing.lg },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }, planText: { ...typography.bodySmall, color: colors.textSecondary },
  signIn: { height: 44, alignItems: 'center', justifyContent: 'center' }, signInText: { ...typography.label, color: colors.textPrimary },
  pressed: { transform: [{ scale: .98 }], opacity: .86 },
});
