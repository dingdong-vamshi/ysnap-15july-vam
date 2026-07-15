import React, { useEffect, useRef, useState } from 'react';
import { Stack, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { AppProviders } from '../providers/AppProviders';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, Platform, View } from 'react-native';
import { colors } from '../constants/colors';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../contexts/ThemeContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { demoProfileStore } from '../utils/tempOnboardingStore';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const iconFontStyles = `
    @font-face {
      font-family: 'Ionicons';
      src: url('https://unpkg.com/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') format('truetype');
    }
    @font-face {
      font-family: 'Feather';
      src: url('https://unpkg.com/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf') format('truetype');
    }
    @font-face {
      font-family: 'Material Community Icons';
      src: url('https://unpkg.com/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf') format('truetype');
    }
  `;

  const style = document.createElement('style');
  style.type = 'text/css';
  if ((style as any).styleSheet) {
    (style as any).styleSheet.cssText = iconFontStyles;
  } else {
    style.appendChild(document.createTextNode(iconFontStyles));
  }
  document.head.appendChild(style);
}

// Demo access intentionally lasts until the app is reloaded. Tab navigation can
// drop URL parameters, so the auth guard must not depend on `demo=1` remaining.
export let demoSessionActive = false;

export function clearDemoSession() {
  demoSessionActive = false;
}

function hasWebDemoSession() {
  return Platform.OS === 'web' && typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ysnap-demo') === '1';
}

function RootLayoutContent() {
  const { user, isLoading: authLoading, signInAnonymously } = useAuth();
  const queryClient = useQueryClient();
  const segments = useSegments() as string[];
  const router = useRouter();
  const { demo } = useGlobalSearchParams<{ demo?: string }>();
  if (demo === '1') {
    demoSessionActive = true;
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') sessionStorage.setItem('ysnap-demo', '1');
  }
  const isDemo = demoSessionActive || hasWebDemoSession();
  const guestAttemptedRef = useRef(false);
  const [isStartingGuest, setIsStartingGuest] = useState(false);

  useEffect(() => {
    if (authLoading || !isDemo || user || guestAttemptedRef.current) return;

    guestAttemptedRef.current = true;
    setIsStartingGuest(true);
    signInAnonymously()
      .then(({ error }) => {
        if (!error) return;

        // Do not leave users inside API-backed screens with only an in-memory
        // demo profile. If hosted guest auth is disabled, recover to sign-in.
        clearDemoSession();
        demoProfileStore.reset();
        router.replace({
          pathname: '/(auth)/sign-in',
          params: { reason: 'guest-access-unavailable' },
        });
      })
      .finally(() => setIsStartingGuest(false));
  }, [authLoading, isDemo, user, signInAnonymously, router]);

  // Load profile state to check onboarding progress
  const { data: profile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const demoProfile = isDemo ? demoProfileStore.get() : null;
  const activeProfile = isDemo ? demoProfile : profile;

  const isTransitioning = (authLoading || isStartingGuest || (!!user && profileLoading)) && segments.join('/') !== 'auth/callback';

  const FORCE_WELCOME_TEST = true; // Set to true to verify onboarding flow sequences starting from welcome

  useEffect(() => {
    if (isTransitioning) return;

    const currentRoute = segments.join('/');
    if (currentRoute === 'auth/callback') {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    // 1. Demo Mode
    if (isDemo) {
      const demoProfile = demoProfileStore.get();
      if (!demoProfile || !demoProfile.onboarding_completed) {
        // Enforce onboarding flow for demo users
        const isLanguagesScreen = segments[1] === 'onboarding-languages';
        const isPermissionsScreen = segments[1] === 'onboarding-permissions';
        
        if (!demoProfile?.native_language || !demoProfile?.primary_target_language) {
          if (!isLanguagesScreen) {
            router.replace('/(auth)/onboarding-languages');
          }
        } else {
          if (!isPermissionsScreen) {
            router.replace('/(auth)/onboarding-permissions');
          }
        }
      } else {
        // Onboarding completed, let them be in tabs
        if (inAuthGroup || segments.length === 0) {
          router.replace('/(tabs)');
        }
      }
      return;
    }

    // 2. No Authenticated User
    if (!user) {
      const allowedPreAuthRoutes = ['welcome', 'onboarding', 'sign-up', 'sign-in'];
      const currentSubRoute = segments[1];
      
      const isAllowed = inAuthGroup && allowedPreAuthRoutes.includes(currentSubRoute);
      if (!isAllowed) {
        router.replace('/(auth)/welcome');
      }
      return;
    }

    // 3. Authenticated User exists
    if (activeProfile) {
      if (!activeProfile.onboarding_completed) {
        // Enforce post-auth setup screens flow
        const isLanguagesScreen = segments[1] === 'onboarding-languages';
        const isPermissionsScreen = segments[1] === 'onboarding-permissions';
        
        if (!activeProfile.native_language || !activeProfile.primary_target_language) {
          if (!isLanguagesScreen) {
            router.replace('/(auth)/onboarding-languages');
          }
        } else {
          if (!isPermissionsScreen) {
            router.replace('/(auth)/onboarding-permissions');
          }
        }
      } else {
        // Onboarding is complete! Go to tabs
        if (inAuthGroup || segments.length === 0) {
          router.replace('/(tabs)');
        }
      }
    } else {
      // User logged in but profile row not loaded/created yet
      // Create a default profile row immediately to prevent loops and direct them to tabs
      const defaultProfile = {
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'YSnap User',
        native_language: user.user_metadata?.native_language || 'en',
        primary_target_language: user.user_metadata?.target_language || 'es',
        onboarding_completed: true,
      };
      
      supabase
        .from('profiles')
        .insert(defaultProfile as any)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        });
    }
  }, [user, profile, activeProfile, isTransitioning, segments, isDemo, queryClient]);

  const { isDark } = useTheme();

  if (isTransitioning) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/welcome" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sign-up" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/onboarding-languages" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/onboarding-permissions" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="conversation-summary" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="privacy-data-usage" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="voice-library" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="voice-clone" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="voice-changer" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="terms" options={{ presentation: 'card', headerShown: false }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AppProviders>
      <RootLayoutContent />
    </AppProviders>
  );
}
