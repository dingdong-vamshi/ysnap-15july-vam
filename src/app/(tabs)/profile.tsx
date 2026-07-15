import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../constants/colors';
import { spacing, layout } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MotionScreen } from '../../components/MotionScreen';
import { ConfirmationModal, DimensionalIcon } from '../../components';
import { demoProfileStore } from '../../utils/tempOnboardingStore';
import { clearDemoSession } from '../_layout';

import { useTheme, useThemeStyles } from '../../contexts/ThemeContext';

export default function ProfileTab() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const styles = useThemeStyles(createStyles);

  const [modalVisible, setModalVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Fetch usage stats
  const { data: usageCount = 0 } = useQuery({
    queryKey: ['usageCountSum', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('usage_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  // Fetch profile
  const { data: profile } = useQuery<any>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const handleNavigation = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path as any);
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalVisible(true);
  };

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Clear local storage / session for demo
      demoProfileStore.reset();
      clearDemoSession();
      
      // Invalidate and clear react-query cache
      queryClient.clear();
      
      // Call Supabase signOut
      await supabase.auth.signOut();
      
      setModalVisible(false);
      router.replace('/(auth)/welcome');
    } catch (e: any) {
      Alert.alert('Sign Out Error', e.message || 'Failed to sign out.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const displayName = profile?.display_name ?? 'YSnap user';
  const avatarInitials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MotionScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.identityRow}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{avatarInitials || 'YS'}</Text>
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
            <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
          </View>

          <View style={styles.quickStatsRow}>
            <View style={styles.quickStatBox}>
              <Text style={styles.quickStatVal}>{usageCount}</Text>
              <Text style={styles.quickStatLabel}>Translations</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatBox}>
              <Text style={styles.quickStatVal}>
                {(profile?.native_language || 'EN').toUpperCase()} → {(profile?.primary_target_language || 'ES').toUpperCase()}
              </Text>
              <Text style={styles.quickStatLabel}>Primary pair</Text>
            </View>
          </View>
        </View>

        {/* Dashboard Navigation Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <Pressable style={styles.menuItem} onPress={() => handleNavigation('/settings')}>
            <View style={styles.menuItemLeft}>
              <View style={{ marginRight: 12 }}>
                <DimensionalIcon
                  icon={<Ionicons name="settings-outline" size={20} />}
                  containerSize={38}
                  size={20}
                  selected={false}
                  depth={2}
                />
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemTitle}>Settings</Text>
                <Text style={styles.menuItemDesc}>Playback, languages, and preferences</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => handleNavigation('/voice-library')}>
            <View style={styles.menuItemLeft}>
              <View style={{ marginRight: 12 }}>
                <DimensionalIcon
                  icon={<Ionicons name="mic-outline" size={20} />}
                  containerSize={38}
                  size={20}
                  selected={false}
                  depth={2}
                />
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemTitle}>Voice library</Text>
                <Text style={styles.menuItemDesc}>Choose and manage playback voices</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => handleNavigation('/privacy-data-usage')}>
            <View style={styles.menuItemLeft}>
              <View style={{ marginRight: 12 }}>
                <DimensionalIcon
                  icon={<Ionicons name="shield-checkmark-outline" size={20} />}
                  containerSize={38}
                  size={20}
                  selected={false}
                  depth={2}
                />
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemTitle}>Privacy and data</Text>
                <Text style={styles.menuItemDesc}>Review, export, or delete your data</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Support Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <Pressable style={styles.menuItem} onPress={() => Alert.alert('Documentation', 'Opening guide docs...')}>
            <View style={styles.menuItemLeft}>
              <View style={{ marginRight: 12 }}>
                <DimensionalIcon
                  icon={<Ionicons name="book-outline" size={20} />}
                  containerSize={38}
                  size={20}
                  selected={false}
                  depth={2}
                />
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemTitle}>YSnap guide</Text>
                <Text style={styles.menuItemDesc}>Tips for better scans and conversations</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Account Controls */}
        <View style={styles.section}>
          <Pressable 
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed
            ]} 
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

      </ScrollView>
      </MotionScreen>
      <ConfirmationModal
        visible={modalVisible}
        title="Sign out of YSnap?"
        body="You'll need to sign in again to access your saved translations and voice settings."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        onConfirm={handleConfirmSignOut}
        onCancel={() => setModalVisible(false)}
        isLoading={isSigningOut}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 110,
  },
  pageTitle: {
    ...typography.heading1,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  profileCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center' },
  identityCopy: { flex: 1, marginLeft: 12 },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLargeText: {
    fontSize: 18,
    fontFamily: typography.heading2.fontFamily,
    fontWeight: '700',
    color: colors.textInverse,
  },
  profileName: { ...typography.heading3, color: colors.textInverse },
  profileEmail: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.68)',
    marginTop: 2,
  },
  proBadge: { backgroundColor: colors.background, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  proBadgeText: { ...typography.micro, color: colors.primary, fontWeight: '700' },
  quickStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 18,
  },
  quickStatBox: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  quickStatVal: {
    ...typography.bodySemibold,
    color: colors.textInverse,
  },
  quickStatLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.62)',
  },
  quickStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  section: {
    marginBottom: 24,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemTextCol: {
    marginLeft: 12,
    flex: 1,
  },
  menuItemTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  menuItemDesc: {
    ...typography.small,
    color: colors.textMuted,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 12,
  },
  signOutButtonPressed: {
    backgroundColor: colors.backgroundMuted,
  },
  signOutText: {
    fontSize: 15,
    fontFamily: typography.bodySemibold.fontFamily,
    fontWeight: typography.bodySemibold.fontWeight,
    color: colors.error,
  },
});
