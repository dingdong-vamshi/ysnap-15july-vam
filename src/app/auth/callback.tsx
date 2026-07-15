import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { TactileButton } from '../../components';

// The verified PKCE callback already establishes a secure session, so retain
// it and continue directly into the application.
const AUTO_SIGN_IN = true;

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function handleCallback() {
      // 1. Read parameters from URL (Expo search parameters)
      const code = params.code as string;
      const tokenHash = params.token_hash as string;
      const type = (params.type as string) || 'signup';

      console.log('AuthCallback processing params:', { hasCode: !!code, hasHash: !!tokenHash, type });

      try {
        if (code) {
          // PKCE Flow
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          console.log('PKCE Session established:', data.session?.user?.email);
        } else if (tokenHash) {
          // Token Hash Flow
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (error) throw error;
          console.log('Token Hash verified. Session established:', data.session?.user?.email);
        } else {
          // If no code or hash, check if there is an active session already
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('No authentication code or token hash found in the redirect URL.');
          }
          console.log('Session already exists:', session.user.email);
        }

        // 2. Fetch or wait for profile creation by the DB trigger
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Authenticated user session not found.');
        }

        // Retry checking profile a few times (up to 3 times, 500ms apart)
        let profile = null;
        for (let i = 0; i < 3; i++) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (data && !error) {
            profile = data;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // If still missing, create a default profile row (failsafe)
        if (!profile) {
          console.log('Profile missing on callback, creating default row...');
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'YSnap user',
              onboarding_completed: false,
            } as any);

          if (insertError) {
            console.error('Failed to create fallback profile:', insertError);
          }
        }

        if (!active) return;
        setStatus('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // 3. Clear auth-session state if manual sign-in is required
        if (!AUTO_SIGN_IN) {
          await supabase.auth.signOut();
        }
      } catch (err: any) {
        console.error('AuthCallback error:', err);
        if (!active) return;
        setStatus('error');
        setErrorMessage(err.message || 'Verification failed. The link may have expired or is invalid.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    handleCallback();

    return () => {
      active = false;
    };
  }, [params]);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (status === 'success') {
      if (AUTO_SIGN_IN) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/sign-in');
      }
    } else {
      router.replace('/(auth)/welcome');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.brand}>YSNAP</Text>

          {status === 'loading' && (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
              <Text style={styles.title}>Confirming your email…</Text>
              <Text style={styles.subtitle}>Please wait while we establish your secure connection.</Text>
            </View>
          )}

          {status === 'success' && (
            <View style={styles.stateContainer}>
              <View style={styles.badgeSuccess}>
                <Text style={styles.badgeSuccessText}>✓</Text>
              </View>
              <Text style={styles.title}>Email confirmed successfully</Text>
              <Text style={styles.subtitle}>
                {AUTO_SIGN_IN 
                  ? 'Your account is ready. Continuing to the application...' 
                  : 'Your account is ready. Sign in to continue.'}
              </Text>
              <TactileButton
                title={AUTO_SIGN_IN ? 'Continue to App' : 'Continue to sign in'}
                onPress={handleContinue}
                style={styles.button}
              />
            </View>
          )}

          {status === 'error' && (
            <View style={styles.stateContainer}>
              <View style={styles.badgeError}>
                <Text style={styles.badgeErrorText}>✕</Text>
              </View>
              <Text style={styles.title}>Verification Failed</Text>
              <Text style={styles.subtitle}>{errorMessage}</Text>
              <TactileButton
                title="Go to Welcome"
                onPress={handleContinue}
                style={styles.button}
              />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E7E6EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
      },
    }),
  },
  brand: {
    ...typography.micro,
    letterSpacing: 2,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 32,
  },
  stateContainer: {
    width: '100%',
    alignItems: 'center',
  },
  loader: {
    marginBottom: 20,
  },
  title: {
    ...typography.heading3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 32,
  },
  badgeSuccess: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  badgeSuccessText: {
    fontSize: 28,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  badgeError: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  badgeErrorText: {
    fontSize: 28,
    color: '#C62828',
    fontWeight: 'bold',
  },
  button: {
    width: '100%',
  },
});
