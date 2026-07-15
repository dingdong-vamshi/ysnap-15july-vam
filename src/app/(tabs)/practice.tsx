import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../constants/colors';
import { spacing, layout, shadows } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MotionScreen } from '../../components/MotionScreen';

interface Phrase {
  source: string;
  target: string;
  category: 'travel' | 'business' | 'saved';
  sourceLang: string;
  targetLang: string;
}

const MOCK_PHRASES: Phrase[] = [
  { source: "Excuse me, where is the nearest train station?", target: "¿Disculpe, dónde está la estación de tren más cercana?", category: 'travel', sourceLang: 'en', targetLang: 'es' },
  { source: "I would like to check in, please.", target: "Me gustaría hacer el registro, por favor.", category: 'travel', sourceLang: 'en', targetLang: 'es' },
  { source: "How much does a taxi to the airport cost?", target: "¿Cuánto cuesta un taxi al aeropuerto?", category: 'travel', sourceLang: 'en', targetLang: 'es' },
  { source: "We need to discuss the terms of the agreement.", target: "Necesitamos discutir los términos del acuerdo.", category: 'business', sourceLang: 'en', targetLang: 'es' },
  { source: "Could you send me the updated proposal?", target: "¿Podría enviarme la propuesta actualizada?", category: 'business', sourceLang: 'en', targetLang: 'es' },
  { source: "Let's schedule a follow-up meeting next week.", target: "Programemos una reunión de seguimiento la próxima semana.", category: 'business', sourceLang: 'en', targetLang: 'es' },
  { source: "Please speak more slowly, I am learning.", target: "Por favor habla más despacio, estoy aprendiendo.", category: 'saved', sourceLang: 'en', targetLang: 'es' },
  { source: "Have a safe flight and see you soon!", target: "¡Ten un buen vuelo y nos vemos pronto!", category: 'saved', sourceLang: 'en', targetLang: 'es' },
];

export default function PracticeTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<'travel' | 'business' | 'saved'>('travel');
  const [selectedPhrase, setSelectedPhrase] = useState<Phrase | null>(null);
  
  // Interactive Session State
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionProgress, setSessionProgress] = useState<'idle' | 'recording' | 'processing' | 'result'>('idle');
  const [simulatedVolume, setSimulatedVolume] = useState<number[]>([10, 10, 10, 10, 10]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Result States
  const [recognizedText, setRecognizedText] = useState('');
  const [accuracyScore, setAccuracyScore] = useState(0);
  const [wordDiffs, setWordDiffs] = useState<Array<{ word: string; status: 'correct' | 'missing' | 'extra' }>>([]);
  const [feedback, setFeedback] = useState('');

  // Refs & Timers
  const timerRef = useRef<any>(null);
  const volIntervalRef = useRef<any>(null);

  // Fetch practice attempts
  const { data: attempts = [] } = useQuery<any[]>({
    queryKey: ['practiceAttempts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('practice_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  // Fetch bookmarks count for "saved" category
  const { data: bookmarks = [] } = useQuery<any[]>({
    queryKey: ['saved_bookmarks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id);
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  // Calculate stats
  const averageScore = attempts.length > 0
    ? Math.round(attempts.reduce((sum, item) => sum + ((item as any).accuracy_score ?? 0), 0) / attempts.length)
    : 0;

  // Insert practice attempt mutation
  const logAttemptMutation = useMutation<any, any, any>({
    mutationFn: async (payload: {
      phrase_source: string;
      phrase_target: string;
      source_language: string;
      target_language: string;
      recognized_text: string;
      accuracy_score: number;
      missing_words: string[];
      extra_words: string[];
      feedback: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('practice_attempts')
        .insert({
          user_id: user.id,
          ...payload,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practiceAttempts', user?.id] });
    },
  });

  // Auto-fill bookmarks into mock phrases if available
  const phrasesToRender = [
    ...MOCK_PHRASES.filter(p => p.category === activeCategory),
    ...bookmarks.map(b => ({
      source: b.source_text,
      target: b.translated_text,
      category: 'saved' as const,
      sourceLang: b.source_language || 'en',
      targetLang: b.target_language || 'es',
    })).filter(p => activeCategory === 'saved')
  ];

  // Daily Challenge Phrase
  const dailyChallenge: Phrase = {
    source: "Where can I pick up my luggage?",
    target: "¿Dónde puedo recoger mi equipaje?",
    category: 'travel',
    sourceLang: 'en',
    targetLang: 'es',
  };

  const handleStartPractice = (phrase: Phrase) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPhrase(phrase);
    setSessionProgress('idle');
    setRecognizedText('');
    setAccuracyScore(0);
    setWordDiffs([]);
    setFeedback('');
    setQuizModalVisible(true);
  };

  const handleToggleRecord = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setSessionProgress('processing');
      clearInterval(timerRef.current!);
      clearInterval(volIntervalRef.current!);
      processSimulatedAudio();
    } else {
      // Start recording
      setIsRecording(true);
      setSessionProgress('recording');
      setRecordingSeconds(0);
      
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      volIntervalRef.current = setInterval(() => {
        setSimulatedVolume(Array.from({ length: 5 }, () => Math.floor(Math.random() * 40) + 10));
      }, 100);
    }
  };

  const processSimulatedAudio = () => {
    if (!selectedPhrase) return;

    // Simulate AI pronunciation analysis
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Randomly make recognized text close but slightly off sometimes for learning
      const originalWords = selectedPhrase.source.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(" ");
      let recWords = [...originalWords];
      let score = 100;
      let missing: string[] = [];
      let extra: string[] = [];

      // 30% chance to simulate a small mistake
      if (Math.random() > 0.6 && recWords.length > 3) {
        // Change one word
        const errIndex = Math.floor(Math.random() * recWords.length);
        const replacedWord = recWords[errIndex];
        recWords[errIndex] = replacedWord + "s"; // plural mistake
        extra.push(recWords[errIndex]);
        missing.push(replacedWord);
        score = 85;
      } else if (Math.random() > 0.8 && recWords.length > 4) {
        // Skip last word
        const popped = recWords.pop();
        if (popped) missing.push(popped);
        score = 80;
      }

      const recText = recWords.join(" ");

      // Calculate diff objects
      const diffObj: Array<{ word: string; status: 'correct' | 'missing' | 'extra' }> = originalWords.map(word => {
        if (missing.includes(word)) {
          return { word, status: 'missing' as const };
        }
        return { word, status: 'correct' as const };
      });

      extra.forEach(word => {
        diffObj.push({ word, status: 'extra' as const });
      });

      setRecognizedText(recText);
      setAccuracyScore(score);
      setWordDiffs(diffObj);

      let feedbackStr = "Perfect pronunciation! Great job.";
      if (score < 90) feedbackStr = "Almost there. Watch out for grammatical agreements and trailing sounds.";
      if (score < 80) feedbackStr = "A bit shaky. Practice enunciating each vowel clearly and maintaining a steady pace.";
      setFeedback(feedbackStr);

      setSessionProgress('result');

      // Log attempt to Supabase
      logAttemptMutation.mutate({
        phrase_source: selectedPhrase.source,
        phrase_target: selectedPhrase.target,
        source_language: selectedPhrase.sourceLang,
        target_language: selectedPhrase.targetLang,
        recognized_text: recText,
        accuracy_score: score,
        missing_words: missing,
        extra_words: extra,
        feedback: feedbackStr,
      });

    }, 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <MotionScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Practice</Text>
          <Text style={styles.subtitle}>Build confidence with short, useful phrases.</Text>
        </View>

        {/* Streak & Stats Row */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Ionicons name="flame-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.statVal}>3 Days</Text>
            <Text style={styles.statLabel}>Active Streak</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.statBox}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.statVal}>{attempts.length}</Text>
            <Text style={styles.statLabel}>Attempts</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.statBox}>
            <Ionicons name="analytics-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.statVal}>{averageScore}%</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
        </View>

        {/* Weekly Streak Checklist */}
        <View style={styles.streakCard}>
          <Text style={styles.cardSectionTitle}>This week</Text>
          <View style={styles.weekRow}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
              const active = idx < 3; // Mock active for Mon-Wed
              return (
                <View key={idx} style={styles.dayCol}>
                  <View style={[styles.dayCircle, active && styles.dayCircleActive]}>
                    {active ? (
                      <Ionicons name="checkmark" size={14} color={colors.textInverse} />
                    ) : (
                      <Text style={styles.dayCircleText}>{day}</Text>
                    )}
                  </View>
                  <Text style={styles.dayLabel}>{day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Daily Challenge Card */}
        <View style={styles.dailyCard}>
          <View style={styles.dailyBadge}>
            <Ionicons name="trophy-outline" size={14} color={colors.textInverse} style={{ marginRight: 4 }} />
            <Text style={styles.dailyBadgeText}>Today’s phrase</Text>
          </View>
          <Text style={styles.dailyPhraseText}>"{dailyChallenge.source}"</Text>
          <Text style={styles.dailyTranslationText}>{dailyChallenge.target}</Text>
          
          <Pressable 
            style={({ pressed }) => [styles.dailyActionBtn, pressed && styles.buttonPressed]}
            onPress={() => handleStartPractice(dailyChallenge)}
          >
            <Text style={styles.dailyActionBtnText}>Practice Now</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
          </Pressable>
        </View>

        {/* Categories Tab Selectors */}
        <View style={styles.categoryContainer}>
          <View style={styles.categoryRow}>
            {(['travel', 'business', 'saved'] as const).map((cat) => (
              <Pressable
                key={cat}
                style={[styles.categoryTab, activeCategory === cat && styles.categoryTabActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveCategory(cat);
                }}
              >
                <Text style={[styles.categoryTabText, activeCategory === cat && styles.categoryTabTextActive]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Selected Category Drills */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          {phrasesToRender.map((phrase, idx) => (
            <Pressable 
              key={idx} 
              style={styles.phrasePracticeCard}
              onPress={() => handleStartPractice(phrase)}
            >
              <View style={styles.drillInfoCol}>
                <Text style={styles.drillPromptText}>{phrase.source}</Text>
                <Text style={styles.drillTranslatedText}>{phrase.target}</Text>
              </View>
              <View style={styles.drillArrowContainer}>
                <Ionicons name="mic-outline" size={20} color={colors.primary} />
              </View>
            </Pressable>
          ))}
          {phrasesToRender.length === 0 && (
            <View style={styles.emptyDrillCard}>
              <Ionicons name="bookmark-outline" size={32} color={colors.disabled} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyDrillText}>
                No phrases found in this category. Go to Home or History to bookmark translations.
              </Text>
            </View>
          )}
        </View>

        {/* Progress Charts (Simulated Bars) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progress</Text>
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsTitle}>Weekly Pronunciation Trend</Text>
            <View style={styles.chartContainer}>
              {[
                { label: 'Mon', score: 85 },
                { label: 'Tue', score: 92 },
                { label: 'Wed', score: 90 },
                { label: 'Thu', score: 95 },
                { label: 'Fri', score: 0 },
                { label: 'Sat', score: 0 },
                { label: 'Sun', score: 0 },
              ].map((day, i) => (
                <View key={i} style={styles.chartColumn}>
                  <View style={styles.chartBarWrapper}>
                    <View style={[styles.chartBar, { height: `${day.score}%`, backgroundColor: colors.primary }]} />
                  </View>
                  <Text style={styles.chartBarLabel}>{day.label}</Text>
                  {day.score > 0 && <Text style={styles.chartBarScore}>{day.score}%</Text>}
                </View>
              ))}
            </View>
          </View>
        </View>

      </ScrollView>
      </MotionScreen>

      {/* QUIZ INTERACTIVE DIALOG MODAL */}
      <Modal
        visible={quizModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setQuizModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.quizModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.quizModalTitle}>Pronunciation Quiz</Text>
              <Pressable onPress={() => setQuizModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            {selectedPhrase && (
              <ScrollView style={styles.quizScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.quizContentCard}>
                  <Text style={styles.quizPromptLabel}>REPEAT THIS PHRASE:</Text>
                  <Text style={styles.quizTargetPhrase}>"{selectedPhrase.source}"</Text>
                  <Text style={styles.quizTargetTranslation}>{selectedPhrase.target}</Text>
                </View>

                {/* Session States */}
                {sessionProgress === 'idle' && (
                  <View style={styles.sessionStatusContainer}>
                    <Ionicons name="volume-medium-outline" size={48} color={colors.accentPurple} style={{ marginBottom: 12 }} />
                    <Text style={styles.sessionStatusText}>Listen carefully, then press recording button below to read the phrase aloud.</Text>
                  </View>
                )}

                {sessionProgress === 'recording' && (
                  <View style={styles.sessionStatusContainer}>
                    <Text style={styles.sessionStatusTextActive}>Listening... {recordingSeconds}s</Text>
                    <View style={styles.waveformRow}>
                      {simulatedVolume.map((vol, i) => (
                        <View key={i} style={[styles.waveBar, { height: vol, backgroundColor: colors.error }]} />
                      ))}
                    </View>
                  </View>
                )}

                {sessionProgress === 'processing' && (
                  <View style={styles.sessionStatusContainer}>
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 12 }} />
                    <Text style={styles.sessionStatusText}>Analyzing accent accuracy...</Text>
                  </View>
                )}

                {sessionProgress === 'result' && (
                  <View style={styles.resultContainer}>
                    {/* Score Badge */}
                    <View style={styles.scoreRow}>
                      <View style={[
                        styles.accuracyCircle,
                        { borderColor: accuracyScore >= 90 ? colors.success : colors.warning }
                      ]}>
                        <Text style={[
                          styles.accuracyScoreNum,
                          { color: accuracyScore >= 90 ? colors.success : colors.warning }
                        ]}>
                          {accuracyScore}%
                        </Text>
                        <Text style={styles.accuracyCircleLabel}>ACCURACY</Text>
                      </View>
                      <View style={styles.feedbackCol}>
                        <Text style={styles.feedbackHeading}>AI Feedback</Text>
                        <Text style={styles.feedbackText}>{feedback}</Text>
                      </View>
                    </View>

                    {/* Recorded Text Difference Display */}
                    <View style={styles.diffCard}>
                      <Text style={styles.diffCardTitle}>SPEECH WORD COMPARISON</Text>
                      <View style={styles.diffWordsRow}>
                        {wordDiffs.map((item, idx) => {
                          let itemColor: string = colors.textPrimary;
                          let textDecor: 'none' | 'line-through' = 'none';

                          if (item.status === 'correct') {
                            itemColor = colors.success;
                          } else if (item.status === 'missing') {
                            itemColor = colors.error;
                            textDecor = 'line-through';
                          } else if (item.status === 'extra') {
                            itemColor = colors.accentOrange;
                          }

                          return (
                            <Text 
                              key={idx} 
                              style={[
                                styles.diffWordText,
                                { color: itemColor, textDecorationLine: textDecor }
                              ]}
                            >
                              {item.word}{' '}
                            </Text>
                          );
                        })}
                      </View>
                      <Text style={styles.diffHelperText}>
                        <Text style={{ color: colors.success }}>■ Correct</Text>  |  
                        <Text style={{ color: colors.error, textDecorationLine: 'line-through' }}> ■ Missing</Text>  |  
                        <Text style={{ color: colors.accentOrange }}> ■ Inserted</Text>
                      </Text>
                    </View>
                  </View>
                )}

                {/* Footer buttons inside Modal */}
                <View style={styles.quizControlsRow}>
                  {sessionProgress === 'result' ? (
                    <Pressable 
                      style={[styles.quizPrimaryActionBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleStartPractice(selectedPhrase)}
                    >
                      <Ionicons name="refresh" size={18} color={colors.textInverse} style={{ marginRight: 6 }} />
                      <Text style={styles.quizPrimaryActionBtnText}>Try Again</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[
                        styles.quizMicBtn,
                        isRecording && styles.quizMicBtnActive
                      ]}
                      onPress={handleToggleRecord}
                      disabled={sessionProgress === 'processing'}
                    >
                      <Ionicons 
                        name={isRecording ? 'stop' : 'mic'} 
                        size={32} 
                        color={colors.textInverse} 
                      />
                    </Pressable>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    ...typography.heading1,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 0,
    borderRadius: 18,
    paddingVertical: 14,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statVal: {
    fontSize: 18,
    fontFamily: typography.bodySemibold.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 6,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
    color: colors.textMuted,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  streakCard: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 18,
    borderWidth: 0,
    padding: spacing.md,
    marginBottom: 20,
  },
  cardSectionTitle: {
    ...typography.captionMedium,
    color: colors.textMuted,
    marginBottom: 12,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  dayCircleActive: {
    backgroundColor: colors.primary,
  },
  dayCircleText: {
    ...typography.smallMedium,
    color: colors.textMuted,
  },
  dayLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  dailyCard: {
    backgroundColor: colors.surfaceSelected,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  dailyBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 14,
  },
  dailyBadgeText: {
    ...typography.smallMedium,
    color: colors.textInverse,
    fontSize: 11,
  },
  dailyPhraseText: {
    ...typography.heading3,
    color: colors.textInverse,
    lineHeight: 28,
  },
  dailyTranslationText: {
    ...typography.body,
    color: colors.textSubtle,
    marginTop: 4,
    marginBottom: 18,
  },
  dailyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: 22,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  dailyActionBtnText: {
    ...typography.buttonSmall,
    color: colors.primary,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSoft,
    padding: 4,
    borderRadius: 12,
    borderWidth: 0,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  categoryTabActive: {
    backgroundColor: colors.background,
    ...shadows.sm,
  },
  categoryTabText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  categoryTabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: typography.heading4.fontFamily,
    fontWeight: typography.heading4.fontWeight,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  phrasePracticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 0,
    padding: 16,
    marginBottom: 8,
  },
  drillInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  drillPromptText: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  drillTranslatedText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  drillArrowContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDrillCard: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDrillText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  analyticsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadows.sm,
  },
  analyticsTitle: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarWrapper: {
    width: 12,
    height: 80,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 6,
  },
  chartBarLabel: {
    ...typography.small,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 6,
  },
  chartBarScore: {
    ...typography.small,
    fontSize: 8,
    color: colors.textPrimary,
    position: 'absolute',
    top: -12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  quizModalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: layout.cardRadius,
    borderTopRightRadius: layout.cardRadius,
    height: '80%',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  quizModalTitle: {
    ...typography.heading3,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  quizScroll: {
    flex: 1,
  },
  quizContentCard: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 20,
  },
  quizPromptLabel: {
    ...typography.smallMedium,
    color: colors.accentPurple,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  quizTargetPhrase: {
    ...typography.heading2,
    color: colors.textPrimary,
    lineHeight: 30,
  },
  quizTargetTranslation: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 6,
  },
  sessionStatusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  sessionStatusText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  sessionStatusTextActive: {
    ...typography.bodySemibold,
    color: colors.error,
    marginBottom: 16,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
  },
  waveBar: {
    width: 6,
    marginHorizontal: 3,
    borderRadius: 3,
  },
  resultContainer: {
    marginTop: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...shadows.sm,
  },
  accuracyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  accuracyScoreNum: {
    fontSize: 22,
    fontWeight: '700',
  },
  accuracyCircleLabel: {
    fontSize: 7,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  feedbackCol: {
    flex: 1,
  },
  feedbackHeading: {
    ...typography.captionMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  feedbackText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  diffCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    ...shadows.sm,
  },
  diffCardTitle: {
    ...typography.smallMedium,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  diffWordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  diffWordText: {
    ...typography.bodySemibold,
    fontSize: 18,
    lineHeight: 26,
  },
  diffHelperText: {
    ...typography.small,
    fontSize: 9,
    color: colors.textSubtle,
    borderTopWidth: 0.5,
    borderColor: colors.border,
    paddingTop: 8,
  },
  quizControlsRow: {
    alignItems: 'center',
    marginVertical: 20,
  },
  quizMicBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  quizMicBtnActive: {
    backgroundColor: colors.error,
    transform: [{ scale: 1.1 }],
  },
  quizPrimaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 24,
    ...shadows.md,
  },
  quizPrimaryActionBtnText: {
    ...typography.buttonSmall,
    color: colors.textInverse,
  },
});
