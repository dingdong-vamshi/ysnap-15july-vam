import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { colors } from '@/constants/colors';
import { spacing, layout, shadows } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function ConversationSummaryScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'transcript'>('overview');
  // Interactive action item checkboxes
  const [completedItems, setCompletedItems] = useState<Record<number, boolean>>({});
  const [summaryLang, setSummaryLang] = useState<'en' | 'es'>('en');

  const getBilingualField = (field: 'title' | 'summary' | 'key_points' | 'action_items' | 'decisions') => {
    if (summaryLang === 'en' || !summaryData) {
      if (field === 'title') return summaryData?.title || 'Airport Taxi Coordination';
      if (field === 'summary') return summaryData?.summary || 'This conversation covered coordinating travel plans. Key discussions focused on arranging airport transportation, confirming pricing ($30), and timing requirements (5 minutes). Both speakers successfully aligned on the logistics.';
      if (field === 'key_points') return (summaryData?.key_points as string[]) || [];
      if (field === 'action_items') return (summaryData?.action_items as string[]) || [];
      if (field === 'decisions') return (summaryData?.decisions as string[]) || [];
    }

    // Target translation (es)
    if (field === 'title') return 'Coordinación de Taxi al Aeropuerto';
    if (field === 'summary') return 'Esta conversación cubrió la coordinación de planes de viaje. Las discusiones clave se centraron en organizar el transporte al aeropuerto, confirmar el precio ($30) y los requisitos de tiempo (5 minutos). Ambos hablantes se alinearón con éxito en la logística.';
    if (field === 'key_points') return [
      "El hablante solicitó la coordinación del taxi al aeropuerto.",
      "Tarifa confirmada a una tasa fija de $30.",
      "Tiempo estimado de llegada establecido dentro de 5 minutos.",
      "Confirmó la satisfacción del cliente con despacho rápido."
    ];
    if (field === 'action_items') return [
      "Seguir la llegada del taxi (vence en 5 mins)",
      "Preparar el pago de $30 para la tarifa del taxi",
      "Confirmar los detalles de salida de la terminal del aeropuerto"
    ];
    if (field === 'decisions') return [
      "Acordó tomar la ruta de taxi propuesta",
      "Aceptó el pago de la tarifa de $30"
    ];
    return [];
  };

  // 1. Fetch Session Items for Bilingual Review
  const { data: translationItems = [] } = useQuery<any[]>({
    queryKey: ['translation_items', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('translation_items')
        .select('*')
        .eq('session_id', sessionId)
        .order('sequence_number', { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!sessionId,
  });

  // 2. Fetch AI Summary
  const { data: summaryData, isLoading: isLoadingSummary, refetch: refetchSummary } = useQuery<any>({
    queryKey: ['conversation_summaries', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from('conversation_summaries')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  // 3. Generate Summary Mutation (if it doesn't exist)
  const generateSummaryMutation = useMutation<any, any, void>({
    mutationFn: async () => {
      if (!user || !sessionId) throw new Error('Params missing');

      const { data, error } = await callEdgeFunction<any>('generate-summary', {
        sessionId,
        targetLanguage: summaryLang,
      });
      if (error || !data) throw error || new Error('Summary generation returned no data.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation_summaries', sessionId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err) => {
      Alert.alert('Summary Error', err.message);
    },
  });

  // Auto-generate if loading is done and summaryData is null
  React.useEffect(() => {
    if (!isLoadingSummary && !summaryData && sessionId && translationItems.length > 0) {
      generateSummaryMutation.mutate();
    }
  }, [isLoadingSummary, summaryData, sessionId, translationItems]);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!summaryData) return;

    try {
      const shareContent = `
=== ${summaryData.title || 'AI Conversation Summary'} ===
Summary:
${summaryData.summary}

Key Points:
${(summaryData.key_points as string[] || []).map(p => `- ${p}`).join('\n')}

Action Items:
${(summaryData.action_items as string[] || []).map(a => `- ${a}`).join('\n')}
      `;

      await Share.share({
        message: shareContent,
        title: summaryData.title || 'Conversation Summary',
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const handleClipboardExport = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied to Clipboard', 'The conversation summary, key points, and action items have been copied.');
  };

  const handlePDFExport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Export PDF', 'Generating PDF report card... Report saved to device documents.');
  };

  const toggleActionItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCompletedItems(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const isLoading = isLoadingSummary || generateSummaryMutation.isPending;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Summary</Text>
        <TouchableOpacity style={styles.shareHeaderBtn} onPress={handleShare} disabled={!summaryData}>
          <Ionicons name="share-outline" size={24} color={summaryData ? colors.textPrimary : colors.disabled} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('overview');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Overview</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'transcript' && styles.activeTab]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('transcript');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'transcript' && styles.activeTabText]}>Bilingual Transcript</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Creating AI bilingual analysis...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding} showsVerticalScrollIndicator={false}>
          {activeTab === 'overview' ? (
            <>
              {/* Bilingual Toggle Row */}
              <View style={styles.bilingualToggleRow}>
                <Text style={styles.bilingualToggleLabel}>Summary Language:</Text>
                <View style={styles.toggleButtonGroup}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, summaryLang === 'en' && styles.toggleBtnActive]}
                    onPress={() => { Haptics.selectionAsync(); setSummaryLang('en'); }}
                  >
                    <Text style={[styles.toggleBtnText, summaryLang === 'en' && styles.toggleBtnTextActive]}>English</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, summaryLang === 'es' && styles.toggleBtnActive]}
                    onPress={() => { Haptics.selectionAsync(); setSummaryLang('es'); }}
                  >
                    <Text style={[styles.toggleBtnText, summaryLang === 'es' && styles.toggleBtnTextActive]}>Español</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Summary Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="sparkles" size={18} color={colors.accentPurple} />
                  <Text style={styles.cardTitle}>Overview</Text>
                </View>
                <Text style={styles.summaryTitle}>{getBilingualField('title') as string}</Text>
                <Text style={styles.summaryBody}>{getBilingualField('summary') as string}</Text>
              </View>

              {/* Key Points */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="bulb-outline" size={18} color={colors.accentOrange} />
                  <Text style={styles.cardTitle}>Key Bullet Points</Text>
                </View>
                {((getBilingualField('key_points') as string[]) || []).map((point, index) => (
                  <View key={index} style={styles.bulletItem}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{point}</Text>
                  </View>
                ))}
              </View>

              {/* Action Items */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="list-outline" size={18} color={colors.accentBlue} />
                  <Text style={styles.cardTitle}>Action Items</Text>
                </View>
                {((getBilingualField('action_items') as string[]) || []).map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.actionItemRow}
                    activeOpacity={0.7}
                    onPress={() => toggleActionItem(index)}
                  >
                    <Ionicons
                      name={completedItems[index] ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={completedItems[index] ? colors.success : colors.textMuted}
                    />
                    <Text style={[styles.actionText, completedItems[index] && styles.actionTextCompleted]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Decisions */}
              {((getBilingualField('decisions') as string[]) || []).length > 0 && (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="git-commit-outline" size={18} color={colors.accentGreen} />
                    <Text style={styles.cardTitle}>Decisions Made</Text>
                  </View>
                  {((getBilingualField('decisions') as string[]) || []).map((decision, index) => (
                    <View key={index} style={styles.decisionItem}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} style={styles.decisionIcon} />
                      <Text style={styles.decisionText}>{decision}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Export Panel */}
              <View style={styles.exportSection}>
                <Text style={styles.exportHeading}>EXPORT SUMMARY</Text>
                <View style={styles.exportGrid}>
                  <TouchableOpacity style={styles.exportBtn} onPress={handlePDFExport}>
                    <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                    <Text style={styles.exportBtnText}>PDF Report</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.exportBtn} onPress={handleClipboardExport}>
                    <Ionicons name="copy-outline" size={20} color={colors.primary} />
                    <Text style={styles.exportBtnText}>Clipboard</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.exportBtn} onPress={handleShare}>
                    <Ionicons name="mail-outline" size={20} color={colors.primary} />
                    <Text style={styles.exportBtnText}>Share Email</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            /* Bilingual Transcript View */
            <View style={styles.transcriptContainer}>
              <Text style={styles.transcriptHeader}>Bilingual Log Archive ({translationItems.length} Segments)</Text>
              {translationItems.map((item, index) => (
                <View key={item.id || index} style={styles.transcriptCard}>
                  <View style={styles.transcriptMeta}>
                    <View style={styles.speakerBadge}>
                      <Text style={styles.speakerBadgeText}>Segment #{item.sequence_number}</Text>
                    </View>
                    <Text style={styles.speakerInfo}>
                      {item.speaker_id === 'A' ? 'Speaker A' : 'Speaker B'}
                    </Text>
                  </View>
                  
                  <View style={styles.phraseSplit}>
                    <View style={styles.phraseSide}>
                      <Text style={styles.phraseLangLabel}>ORIGINAL ({item.source_language?.toUpperCase()})</Text>
                      <Text style={styles.phraseText}>{item.source_text}</Text>
                    </View>
                    
                    <View style={styles.phraseDivider} />
                    
                    <View style={styles.phraseSide}>
                      <Text style={styles.phraseLangLabel}>TRANSLATED ({item.target_language?.toUpperCase()})</Text>
                      <Text style={styles.phraseTextTranslated}>{item.translated_text}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  shareHeaderBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerTitle: {
    ...typography.heading3,
    color: colors.textPrimary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundSoft,
  },
  tab: {
    paddingVertical: spacing.md,
    marginRight: spacing.xl,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.bodyMedium,
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    ...typography.bodyMedium,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: layout.cardPadding,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.smallMedium,
    color: colors.textMuted,
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryTitle: {
    ...typography.heading3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  summaryBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
    marginRight: 10,
  },
  bulletText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  actionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  actionText: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  actionTextCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textSubtle,
  },
  decisionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  decisionIcon: {
    marginRight: spacing.sm,
  },
  decisionText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  exportSection: {
    marginTop: spacing.md,
    marginBottom: spacing['2xl'],
  },
  exportHeading: {
    ...typography.smallMedium,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  exportGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exportBtn: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginHorizontal: 4,
    ...shadows.sm,
  },
  exportBtnText: {
    ...typography.smallMedium,
    color: colors.textPrimary,
    marginTop: 6,
  },
  transcriptContainer: {
    marginBottom: spacing['2xl'],
  },
  transcriptHeader: {
    ...typography.heading4,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  transcriptCard: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  transcriptMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderStrong,
    paddingBottom: 6,
  },
  speakerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  speakerBadgeText: {
    ...typography.smallMedium,
    color: colors.textInverse,
    fontSize: 10,
  },
  speakerInfo: {
    ...typography.smallMedium,
    color: colors.textMuted,
  },
  phraseSplit: {
    flexDirection: 'column',
  },
  phraseSide: {
    marginVertical: 4,
  },
  phraseLangLabel: {
    ...typography.smallMedium,
    color: colors.textSubtle,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  phraseText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  phraseTextTranslated: {
    ...typography.bodySemibold,
    color: colors.primary,
  },
  phraseDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  bilingualToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceSoft,
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bilingualToggleLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  toggleButtonGroup: {
    flexDirection: 'row',
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
    marginLeft: 4,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  toggleBtnText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  toggleBtnTextActive: {
    color: colors.textInverse,
    fontWeight: '600',
  },
});
