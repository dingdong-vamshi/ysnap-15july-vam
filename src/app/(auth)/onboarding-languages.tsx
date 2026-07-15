import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, Modal, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { languages, getLanguageName } from '../../constants/languages';
import { PrimaryButton } from '../../components/PrimaryButton';
import { tempOnboardingStore, demoProfileStore } from '../../utils/tempOnboardingStore';
import { 
  OnboardingShell,
  OnboardingProgressHeader,
  IllustrationFrame,
  OnboardingOptionCard,
  OnboardingFooter,
  ResponsiveOnboardingLayout,
} from '../../components';
import { 
  ArrowRight as LucideArrowRight,
  ChevronRight as LucideChevronRight,
  X as LucideX,
  Search as LucideSearch,
  Check as LucideCheck,
  Plane as LucidePlane,
  Briefcase as LucideBriefcase,
  BookOpen as LucideBookOpen,
  MessageSquare as LucideMessageSquare
} from 'lucide-react-native';

const ArrowRight = LucideArrowRight as any;
const ChevronRight = LucideChevronRight as any;
const X = LucideX as any;
const Search = LucideSearch as any;
const Check = LucideCheck as any;
const Plane = LucidePlane as any;
const Briefcase = LucideBriefcase as any;
const BookOpen = LucideBookOpen as any;
const MessageSquare = LucideMessageSquare as any;

interface PurposeOption {
  id: string;
  title: string;
  description: string;
  icon: any;
}

const PURPOSES: PurposeOption[] = [
  { id: 'travel', title: 'Travel & Exploration', description: 'Translate signs, menus, and chat with locals.', icon: Plane },
  { id: 'business', title: 'Business & Work', description: 'Professional conversations and document translations.', icon: Briefcase },
  { id: 'study', title: 'Learning & Study', description: 'Practice speaking, vocabulary building, and syntax.', icon: BookOpen },
  { id: 'social', title: 'Everyday Practice', description: 'Chat with friends and family in multiple languages.', icon: MessageSquare },
];

import { useTheme, useThemeStyles } from '../../contexts/ThemeContext';

export default function OnboardingLanguagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const styles = useThemeStyles(createStyles);

  const tempChoices = tempOnboardingStore.get();

  const [nativeLang, setNativeLang] = useState(tempChoices?.native ?? 'en');
  const [targetLang, setTargetLang] = useState(tempChoices?.target ?? 'es');
  const [purpose, setPurpose] = useState(tempChoices?.purpose ?? 'travel');
  
  // Picker modal state
  const [pickerMode, setPickerMode] = useState<'native' | 'target' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLanguages = languages.filter(lang => 
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectLanguage = (code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pickerMode === 'native') {
      setNativeLang(code);
    } else {
      setTargetLang(code);
    }
    setPickerMode(null);
    setSearchQuery('');
  };

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user?.id) {
      demoProfileStore.set({
        native_language: nativeLang,
        primary_target_language: targetLang,
        translation_purpose: purpose,
      });
      router.push('/(auth)/onboarding-permissions');
      return;
    }

    // Save temporary state or mutate the profile
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          native_language: nativeLang,
          primary_target_language: targetLang,
          translation_purpose: purpose,
        })
        .eq('id', user.id);

      if (error) throw error;
      
      // Invalidate query to update layout cache
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });

      // Clear temporary onboarding choices
      tempOnboardingStore.clear();
      
      router.push('/(auth)/onboarding-permissions');
    } catch (e) {
      console.error('Error saving languages:', e);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OnboardingProgressHeader
        currentStep={0}
        totalSteps={2}
        onBack={() => router.replace('/(auth)/welcome')}
      />
      <OnboardingShell>
        <ResponsiveOnboardingLayout>
          <IllustrationFrame imageId="IMG-013" />
          <View>
            <Text style={styles.kicker}>PROFILE SETUP</Text>
            <Text style={styles.title}>Which languages do you use?</Text>
            <Text style={styles.subtitle}>
              Choose a starting pair. You can switch languages anytime.
            </Text>

            {/* Language Selectors */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your language pair</Text>
              
              <Pressable 
                style={styles.pickerButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPickerMode('native');
                }}
              >
                <View>
                  <Text style={styles.pickerLabel}>I speak</Text>
                  <Text style={styles.pickerValue}>{getLanguageName(nativeLang)}</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>

              <Pressable 
                style={styles.pickerButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPickerMode('target');
                }}
              >
                <View>
                  <Text style={styles.pickerLabel}>Translate to</Text>
                  <Text style={styles.pickerValue}>{getLanguageName(targetLang)}</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Translation Purpose */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What brings you to YSnap?</Text>
              <Text style={styles.sectionSubtitle}>This helps us prioritize the tools you’ll use most.</Text>
              
              <View style={styles.grid}>
                {PURPOSES.map((item) => (
                  <OnboardingOptionCard
                    key={item.id}
                    label={item.title}
                    detail={item.description}
                    icon={item.icon}
                    selected={purpose === item.id}
                    onPress={() => setPurpose(item.id)}
                  />
                ))}
              </View>
            </View>
          </View>
        </ResponsiveOnboardingLayout>
      </OnboardingShell>

      {/* Next Button Footer */}
      <OnboardingFooter>
        <PrimaryButton
          title="Continue"
          onPress={handleNext}
          icon={<ArrowRight size={18} color={colors.textInverse} />}
          iconPosition="right"
        />
      </OnboardingFooter>

      {/* Language Picker Modal */}
      <Modal
        visible={pickerMode !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerMode(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {pickerMode === 'native' ? 'Select Native Language' : 'Select Target Language'}
            </Text>
            <Pressable 
              style={styles.closeButton} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPickerMode(null);
              }}
            >
              <X size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.searchBarContainer}>
            <Search size={20} color={colors.textSubtle} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search languages..."
              placeholderTextColor={colors.textSubtle}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filteredLanguages}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable 
                style={styles.languageItem}
                onPress={() => selectLanguage(item.code)}
              >
                <View>
                  <Text style={styles.languageName}>{item.name}</Text>
                  <Text style={styles.languageNative}>{item.nativeName}</Text>
                </View>
                {(pickerMode === 'native' ? nativeLang : targetLang) === item.code && (
                  <Check size={20} color={colors.accentPurple} />
                )}
              </Pressable>
            )}
            contentContainerStyle={styles.listContainer}
          />
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
    width: '50%',
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: typography.heading4.fontFamily,
    fontWeight: typography.heading4.fontWeight,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
    color: colors.textMuted,
    marginBottom: 16,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSoft,
    borderWidth: 0,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 12,
    fontFamily: typography.captionMedium.fontFamily,
    color: colors.textMuted,
    marginBottom: 4,
  },
  pickerValue: {
    fontSize: 16,
    fontFamily: typography.bodyMedium.fontFamily,
    fontWeight: typography.bodyMedium.fontWeight,
    color: colors.textPrimary,
  },
  grid: {
    gap: 12,
  },
  purposeCard: {
    backgroundColor: colors.backgroundSoft,
    borderWidth: 0,
    borderRadius: 18,
    padding: 16,
  },
  purposeCardSelected: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.surfaceSelected,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 0,
  },
  iconWrapperSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'transparent',
  },
  purposeTitle: {
    fontSize: 15,
    fontFamily: typography.bodySemibold.fontFamily,
    fontWeight: typography.bodySemibold.fontWeight,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  purposeTitleSelected: {
    color: colors.textInverse,
  },
  purposeDescription: {
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    color: colors.textSecondary,
  },
  purposeDescriptionSelected: {
    color: colors.textSubtle,
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
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: typography.button.fontFamily,
    fontWeight: typography.button.fontWeight,
    color: colors.textInverse,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: typography.heading3.fontFamily,
    fontWeight: typography.heading3.fontWeight,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
    color: colors.textPrimary,
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  languageName: {
    fontSize: 16,
    fontFamily: typography.bodyMedium.fontFamily,
    fontWeight: typography.bodyMedium.fontWeight,
    color: colors.textPrimary,
  },
  languageNative: {
    fontSize: 13,
    fontFamily: typography.caption.fontFamily,
    color: colors.textMuted,
    marginTop: 2,
  },
});
