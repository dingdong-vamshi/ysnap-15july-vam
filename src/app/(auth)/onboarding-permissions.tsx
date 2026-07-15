import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { AudioModule } from 'expo-audio';
import { Camera as ExpoCamera } from 'expo-camera';
import { 
  OnboardingShell,
  OnboardingProgressHeader,
  IllustrationFrame,
  OnboardingFooter,
  ResponsiveOnboardingLayout,
  TactileButton,
  DimensionalIcon,
} from '../../components';
import { demoProfileStore } from '../../utils/tempOnboardingStore';
import { 
  Mic as LucideMic, 
  Camera as LucideCamera, 
  Check as LucideCheck, 
  Info as LucideInfo, 
  CheckCircle as LucideCheckCircle 
} from 'lucide-react-native';

const Mic = LucideMic as any;
const Camera = LucideCamera as any;
const Check = LucideCheck as any;
const Info = LucideInfo as any;
const CheckCircle = LucideCheckCircle as any;

interface PermissionCardProps {
  title: string;
  description: string;
  icon: any;
  isGranted: boolean | null;
  onRequest: () => void;
}

function PermissionCard({ title, description, icon, isGranted, onRequest }: PermissionCardProps) {
  const IconComponent = icon;
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <DimensionalIcon
          icon={<IconComponent size={20} color={isGranted ? '#FFFFFF' : '#111111'} />}
          selected={isGranted === true}
          containerSize={44}
        />
        <View style={styles.cardTextContainer}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{description}</Text>
        </View>
      </View>
      <Pressable 
        style={[
          styles.actionButton,
          isGranted === true && styles.actionButtonGranted,
          isGranted !== true && styles.actionButtonActive
        ]}
        onPress={onRequest}
        disabled={isGranted === true}
      >
        {isGranted === true ? (
          <Check size={16} color={colors.success} />
        ) : (
          <Text style={styles.actionButtonText}>Allow</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function OnboardingPermissionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const requestMicrophone = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setMicGranted(status.granted);
    } catch (e) {
      console.error(e);
      setMicGranted(false);
    }
  };

  const requestCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { status } = await ExpoCamera.requestCameraPermissionsAsync();
      setCameraGranted(status === 'granted');
    } catch (e) {
      console.error(e);
      setCameraGranted(false);
    }
  };

  const handleComplete = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user?.id) {
      demoProfileStore.set({ onboarding_completed: true });
      router.replace('/(tabs)');
      return;
    }

    setLoading(true);
    try {
      // Mark onboarding as completed in user profile
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (error) throw error;

      // Invalidate queries so RootLayout gets fresh state and routes user to (tabs)
      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    } catch (e) {
      console.error('Error saving onboarding state:', e);
      Alert.alert('Error', 'Could not complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <OnboardingProgressHeader
        currentStep={1}
        totalSteps={2}
        onBack={() => router.replace('/(auth)/onboarding-languages')}
      />
      <OnboardingShell>
        <ResponsiveOnboardingLayout>
          <IllustrationFrame imageId="IMG-010" />
          <View>
            <Text style={styles.kicker}>PRIVACY & PERMISSIONS</Text>
            <Text style={styles.title}>Translate what you see and hear</Text>
            <Text style={styles.subtitle}>
              Allow access when you’re ready. YSnap only uses the camera or microphone while you’re using those tools.
            </Text>

            {/* Permissions List */}
            <View style={styles.list}>
              <PermissionCard
                title="Microphone"
                description="Speak, practice pronunciation, and translate conversations."
                icon={Mic}
                isGranted={micGranted}
                onRequest={requestMicrophone}
              />

              <PermissionCard
                title="Camera"
                description="Translate signs, menus, labels, and documents in view."
                icon={Camera}
                isGranted={cameraGranted}
                onRequest={requestCamera}
              />
            </View>

            <View style={styles.hintContainer}>
              <Info size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <Text style={styles.hintText}>
                You can modify these choices at any time in your iOS or Android system settings.
              </Text>
            </View>
          </View>
        </ResponsiveOnboardingLayout>
      </OnboardingShell>

      {/* Footer Complete Button */}
      <OnboardingFooter>
        <TactileButton
          title="Continue"
          onPress={handleComplete}
          loading={loading}
        />
      </OnboardingFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  kicker: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 32,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 28,
  },
  progressFill: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  stepText: {
    fontSize: 11,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: typography.captionMedium.fontWeight,
    color: colors.textMuted,
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontFamily: typography.heading1.fontFamily,
    fontWeight: typography.heading1.fontWeight,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  list: {
    gap: 16,
    marginBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSoft,
    borderWidth: 0,
    borderRadius: 18,
    padding: 16,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  iconContainerGranted: {
    backgroundColor: colors.surfaceSuccess,
    borderColor: colors.successLight,
  },
  cardTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: typography.bodySemibold.fontFamily,
    fontWeight: typography.bodySemibold.fontWeight,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonActive: {
    backgroundColor: '#111111',
    borderColor: '#2D2D2D',
    borderWidth: 1,
    borderBottomWidth: 3,
    borderBottomColor: '#000000',
  },
  actionButtonGranted: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.success,
  },
  actionButtonText: {
    fontSize: 13,
    fontFamily: typography.buttonSmall.fontFamily,
    fontWeight: typography.buttonSmall.fontWeight,
    color: colors.textInverse,
  },
  hintContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSoft,
    padding: 12,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    color: colors.textMuted,
    lineHeight: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 0,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  completeButtonText: {
    fontSize: 16,
    fontFamily: typography.button.fontFamily,
    fontWeight: typography.button.fontWeight,
    color: colors.textInverse,
  },
});
