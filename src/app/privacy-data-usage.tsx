import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Alert,
  SafeAreaView,
  Share,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../constants/colors';
import { spacing, layout, shadows } from '../constants/spacing';
import { typography } from '../constants/typography';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function PrivacyDataUsageScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch usage events
  const { data: usageEvents = [], isLoading } = useQuery<any[]>({
    queryKey: ['usageEvents', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('usage_events')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  // Calculate dynamic stats
  const translationCount = usageEvents.filter(e => e.event_type === 'translation').reduce((sum, e) => sum + e.quantity, 0);
  const ttsCount = usageEvents.filter(e => e.event_type === 'tts').reduce((sum, e) => sum + e.quantity, 0);
  const imgCount = usageEvents.filter(e => e.event_type === 'image_analysis').reduce((sum, e) => sum + e.quantity, 0);
  const cloneCount = usageEvents.filter(e => e.event_type === 'voice_clone').reduce((sum, e) => sum + e.quantity, 0);

  // Limits
  const LIMITS = {
    translation: 1000,
    tts: 500,
    image_analysis: 100,
    voice_clone: 3,
  };

  // Mutations to purge history
  const purgeHistoryMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      
      // Delete translation sessions which cascades to translation items
      const { error } = await supabase
        .from('translation_sessions')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;

      // Also clear usage events logs for full privacy
      const { error: usageErr } = await supabase
        .from('usage_events')
        .delete()
        .eq('user_id', user.id);
      
      if (usageErr) throw usageErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usageEvents', user?.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('History Purged', 'All raw translation transcripts and cached audio logs have been permanently deleted.');
    },
    onError: (err) => {
      Alert.alert('Purge Error', err.message);
    }
  });

  // Mutation to delete profile (Soft simulation of absolute account wipe)
  const deleteProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      // 1. Delete preferences
      await supabase.from('user_preferences').delete().eq('user_id', user.id);
      
      // 2. Delete voice profiles
      await supabase.from('voice_profiles').delete().eq('user_id', user.id);

      // 3. Delete sessions
      await supabase.from('translation_sessions').delete().eq('user_id', user.id);

      // 4. Delete profile row
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Account Wiped', 'Your profile and matching translations have been destroyed. Signing out.', [
        { text: 'OK', onPress: () => router.replace('/') }
      ]);
    },
    onError: (err) => {
      Alert.alert('Wipe Error', err.message);
    }
  });

  const handleExportData = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Fetch translations text to export
    const { data: items } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user?.id || '');

    const exportText = items && items.length > 0
      ? (items as any[]).map(item => `[${item.source_language} ➔ ${item.target_language}] ${item.source_text} = ${item.translated_text}`).join('\n')
      : 'No bookmarked items found in database logs.';

    const shareContent = `
=== YSnap Data Export ===
User Email: ${user?.email}
Timestamp: ${new Date().toISOString()}

Bookmarks History:
${exportText}

Usage Metrics:
- Text & Audio translations: ${translationCount} / ${LIMITS.translation} scans
- Text-to-Speech voices generated: ${ttsCount} / ${LIMITS.tts} requests
- Camera & Meal analysis scans: ${imgCount} / ${LIMITS.image_analysis} images
    `;

    try {
      await Share.share({
        message: shareContent,
        title: 'YSnap Data Logs Export',
      });
    } catch (err) {
      console.log('Error sharing data export:', err);
    }
  };

  const handlePurgeHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Purge History',
      'This will permanently delete all conversation transcripts, camera analysis, and practice metrics logs. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Purge History', style: 'destructive', onPress: () => purgeHistoryMutation.mutate() }
      ]
    );
  };

  const handleDeleteProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'DELETE ACCOUNT WIPE',
      'Are you absolutely sure you want to delete your profile? All custom voice clones, preferences, and saved logs will be wiped out from Supabase storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Destroy All Data', style: 'destructive', onPress: () => deleteProfileMutation.mutate() }
      ]
    );
  };

  const getPercent = (value: number, max: number) => {
    return Math.min(Math.round((value / max) * 100), 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy & Data</Text>
        <View style={styles.spacerBtn} />
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Usage Trackers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quota Limits Tracking</Text>
            
            {/* Translation Progress */}
            <View style={styles.quotaCard}>
              <View style={styles.quotaHeader}>
                <Text style={styles.quotaLabel}>Translations & Scans</Text>
                <Text style={styles.quotaVal}>{translationCount} / {LIMITS.translation}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${getPercent(translationCount, LIMITS.translation)}%`, backgroundColor: colors.accentBlue }]} />
              </View>
              <Text style={styles.quotaHelper}>{getPercent(translationCount, LIMITS.translation)}% of monthly allocation used</Text>
            </View>

            {/* TTS requests */}
            <View style={styles.quotaCard}>
              <View style={styles.quotaHeader}>
                <Text style={styles.quotaLabel}>Text-To-Speech requests</Text>
                <Text style={styles.quotaVal}>{ttsCount} / {LIMITS.tts}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${getPercent(ttsCount, LIMITS.tts)}%`, backgroundColor: colors.accentPurple }]} />
              </View>
              <Text style={styles.quotaHelper}>{getPercent(ttsCount, LIMITS.tts)}% of monthly allocation used</Text>
            </View>

            {/* Food Image analyses */}
            <View style={styles.quotaCard}>
              <View style={styles.quotaHeader}>
                <Text style={styles.quotaLabel}>Food Image AI analysis</Text>
                <Text style={styles.quotaVal}>{imgCount} / {LIMITS.image_analysis}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${getPercent(imgCount, LIMITS.image_analysis)}%`, backgroundColor: colors.accentGreen }]} />
              </View>
              <Text style={styles.quotaHelper}>{getPercent(imgCount, LIMITS.image_analysis)}% of monthly allocation used</Text>
            </View>

            {/* Voice clones */}
            <View style={styles.quotaCard}>
              <View style={styles.quotaHeader}>
                <Text style={styles.quotaLabel}>Voice Clone slots</Text>
                <Text style={styles.quotaVal}>{cloneCount} / {LIMITS.voice_clone}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${getPercent(cloneCount, LIMITS.voice_clone)}%`, backgroundColor: colors.accentOrange }]} />
              </View>
              <Text style={styles.quotaHelper}>{getPercent(cloneCount, LIMITS.voice_clone)}% slots activated</Text>
            </View>
          </View>

          {/* Data Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Control Actions</Text>
            
            <Pressable 
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]} 
              onPress={handleExportData}
            >
              <Ionicons name="download-outline" size={20} color={colors.textPrimary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnTitle}>Request Export Data logs</Text>
                <Text style={styles.actionBtnDesc}>Get a text-file of all your translation vocabulary.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]} 
              onPress={handlePurgeHistory}
            >
              <Ionicons name="trash-outline" size={20} color={colors.warning} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionBtnTitle, { color: colors.warning }]}>Clear raw history logs</Text>
                <Text style={styles.actionBtnDesc}>Destroys local device history and cloud server database cache.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]} 
              onPress={handleDeleteProfile}
            >
              <Ionicons name="alert-circle-outline" size={20} color={colors.error} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionBtnTitle, { color: colors.error }]}>Delete profile completely</Text>
                <Text style={styles.actionBtnDesc}>Purges identity, settings, clones, and logs. This is permanent.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...typography.heading3,
    color: colors.textPrimary,
  },
  spacerBtn: {
    width: layout.touchTarget,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: typography.captionMedium.fontWeight,
    color: colors.accentPurple,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  quotaCard: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quotaLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  quotaVal: {
    ...typography.smallMedium,
    color: colors.textSecondary,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.backgroundMuted,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  quotaHelper: {
    ...typography.small,
    color: colors.textMuted,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  actionBtnTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  actionBtnDesc: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
});
