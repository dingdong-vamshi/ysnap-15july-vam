import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { tempOnboardingStore, demoProfileStore } from '../../utils/tempOnboardingStore';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { TactileButton } from '../../components';

export default function SignInScreen() {
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { signIn, resetPassword, signInAnonymously } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email address is invalid';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const queryClient = useQueryClient();

  const handleDemoMode = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const { error } = await signInAnonymously();
      if (error) throw error;
      const tempChoices = tempOnboardingStore.get();
      demoProfileStore.set({
        onboarding_completed: false,
        native_language: tempChoices?.native ?? 'en',
        primary_target_language: tempChoices?.target ?? 'es',
        translation_purpose: tempChoices?.purpose ?? 'travel',
      });
      router.replace({ pathname: '/(auth)/onboarding-languages', params: { demo: '1' } });
    } catch (error: any) {
      Alert.alert(
        'Guest Access Unavailable',
        error?.message === 'Anonymous sign-ins are disabled'
          ? 'Guest access is not enabled for this project yet. Please sign in with an account.'
          : error?.message || 'Could not start a guest session.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!validate()) return;

    setLoading(true);
    try {
      const { data, error } = await signIn(email.trim(), password);
      
      if (error) {
        setLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        let errorMsg = error.message;
        if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
          errorMsg = 'Incorrect email or password. Please try again.';
        } else if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
          errorMsg = 'Please verify your email address before signing in.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMsg = 'Network error. Please check your internet connection and try again.';
        }
        
        Alert.alert('Sign In Failed', errorMsg);
        return;
      }

      const session = data?.session;
      const user = data?.user;

      if (!session || !user) {
        setLoading(false);
        Alert.alert('Sign In Failed', 'Could not establish session. Please verify your credentials or email status.');
        return;
      }

      // Fetch profile
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      let activeProfile = profile;

      if (fetchError || !profile) {
        // Safe creation of a default profile row if missing
        const defaultProfile = {
          id: user.id,
          email: user.email,
          display_name: user.user_metadata?.display_name || email.split('@')[0],
          native_language: user.user_metadata?.native_language || 'en',
          primary_target_language: user.user_metadata?.target_language || 'es',
          onboarding_completed: true,
        };
        const { error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile as any);

        if (insertError) {
          setLoading(false);
          Alert.alert('Profile Error', 'Your profile is missing and could not be initialized automatically. Please contact support.');
          return;
        }
        activeProfile = defaultProfile as any;
      }

      // Invalidate local profile queries
      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });

      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Route directly to main application tabs
      router.replace('/(tabs)');
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Sign In Error', e.message || 'An unexpected error occurred.');
    }
  };

  const handleForgotPassword = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!email) {
      setErrors({ email: 'Please enter your email address to reset your password' });
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrors({ email: 'Email address is invalid' });
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);

    if (error) {
      Alert.alert('Reset Failed', error.message);
    } else {
      Alert.alert('Reset Link Sent', 'Check your email for password reset instructions.');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <StatusBar style="dark" />
        
        {/* Header */}
        <View style={styles.header}>
          <Pressable 
            style={styles.backButton} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your YSnap account to resume translating.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {reason === 'guest-access-unavailable' && (
            <View style={styles.authNotice}>
              <Text style={styles.authNoticeText}>
                Sign in to translate and securely save your history. Guest access is not enabled for this project.
              </Text>
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="name@domain.com"
              placeholderTextColor={colors.textSubtle}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.passwordHeader}>
              <Text style={styles.label}>Password</Text>
              <Pressable onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              placeholder="••••••••"
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <TactileButton
            title="Sign In"
            onPress={handleSignIn}
            loading={loading}
            style={styles.buttonSpacing}
          />

          {reason !== 'guest-access-unavailable' && (
            <TactileButton
              variant="secondary"
              title="Continue as Guest"
              onPress={handleDemoMode}
            />
          )}

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Pressable 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.replace({
                  pathname: '/(auth)/sign-up',
                  params: reason ? { reason } : {},
                });
              }}
            >
              <Text style={styles.footerLink}>Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 20,
    marginBottom: 40,
  },
  backButton: {
    marginBottom: 24,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    fontSize: 15,
    fontFamily: typography.bodyMedium.fontFamily,
    fontWeight: typography.bodyMedium.fontWeight,
    color: colors.textMuted,
  },
  title: {
    fontSize: 28,
    fontFamily: typography.heading1.fontFamily,
    fontWeight: typography.heading1.fontWeight,
    color: colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
    fontWeight: typography.body.fontWeight,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  form: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  authNotice: {
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  authNoticeText: {
    fontSize: 13,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
    lineHeight: 19,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: typography.captionMedium.fontWeight,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: typography.captionMedium.fontWeight,
    color: colors.accentPurple,
  },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  errorText: {
    fontSize: 12,
    fontFamily: typography.small.fontFamily,
    color: colors.error,
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: typography.button.fontFamily,
    fontWeight: typography.button.fontWeight,
    color: colors.textInverse,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 15,
    fontFamily: typography.bodySemibold.fontFamily,
    fontWeight: typography.bodySemibold.fontWeight,
    color: colors.primary,
  },
  bypassBtn: {
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  bypassBtnText: {
    fontSize: 15,
    fontFamily: typography.button.fontFamily,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  buttonSpacing: {
    marginBottom: 12,
    marginTop: 16,
  },
});
