import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Clipboard,
  Platform,
  Alert,
} from 'react-native';
import { useCameraState } from './cameraState';
import { colors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface CameraResultSheetProps {
  onSaveCorrection: (correctedData: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    ingredients: string[];
  }) => void;
  onRetake: () => void;
  onDone: () => void;
  onSpeak: () => void;
}

export const CameraResultSheet: React.FC<CameraResultSheetProps> = ({
  onSaveCorrection,
  onRetake,
  onDone,
  onSpeak,
}) => {
  const {
    cameraState,
    setCameraState,
    visualResult,
    spokenTranscript,
    isPlayingLiveAudio,
    resetCameraSession,
  } = useCameraState();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedCalories, setEditedCalories] = useState('');
  const [editedProtein, setEditedProtein] = useState('');
  const [editedCarbs, setEditedCarbs] = useState('');
  const [editedFat, setEditedFat] = useState('');
  const [editedIngredients, setEditedIngredients] = useState('');

  if (cameraState !== 'result' && cameraState !== 'speaking' && cameraState !== 'follow_up') return null;
  if (!visualResult) return null;

  const isFood = visualResult.category === 'food';
  const foodData = visualResult.food;
  const nutrition = foodData?.estimatedNutrition;

  const startEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditedName(foodData?.name || visualResult.title || '');
    setEditedCalories(String(nutrition?.calories || 0));
    setEditedProtein(String(nutrition?.protein_g || 0));
    setEditedCarbs(String(nutrition?.carbs_g || 0));
    setEditedFat(String(nutrition?.fat_g || 0));
    setEditedIngredients(foodData?.visibleIngredients?.join(', ') || '');
    setIsEditing(true);
  };

  const saveEdit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const corrected = {
      name: editedName.trim(),
      calories: Number(editedCalories) || 0,
      protein: Number(editedProtein) || 0,
      carbs: Number(editedCarbs) || 0,
      fat: Number(editedFat) || 0,
      ingredients: editedIngredients.split(',').map((i) => i.trim()).filter(Boolean),
    };
    onSaveCorrection(corrected);
    setIsEditing(false);
  };

  const copyTranscript = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Clipboard.setString(spokenTranscript || visualResult.spokenSummary);
    Alert.alert('Copied', 'Spoken transcript copied to clipboard.');
  };

  return (
    <View style={styles.sheetContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Category & Title */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{visualResult.category.toUpperCase()}</Text>
          </View>
          <Text style={styles.title}>{visualResult.title}</Text>
          <Text style={styles.summary}>{visualResult.summary}</Text>
        </View>

        {/* Audio Spoken Summary */}
        <View style={styles.spokenCard}>
          <View style={styles.spokenHeader}>
            <Ionicons name="volume-medium" size={20} color={colors.accentPurple || '#7C6CD0'} />
            <Text style={styles.spokenTitle}>Spoken Explanation</Text>
            {isPlayingLiveAudio ? (
              <Pressable style={styles.stopBtn} onPress={() => resetCameraSession()}>
                <Text style={styles.stopText}>Stop</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.speakBtn} onPress={onSpeak}>
                <Ionicons name="play" size={12} color="#FFFFFF" />
                <Text style={styles.speakText}>Play</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.spokenBody}>{spokenTranscript || visualResult.spokenSummary}</Text>
          {spokenTranscript.length > 0 && (
            <View style={styles.transcriptControls}>
              <Pressable style={styles.iconControl} onPress={copyTranscript}>
                <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.controlText}>Copy</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Food & Macros Section */}
        {isFood && foodData && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Nutrition Estimates</Text>
            <Text style={styles.disclaimer}>
              *Estimated values. Portions and ingredients may affect the result.
            </Text>

            {isEditing ? (
              <View style={styles.editCard}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Meal Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editedName}
                    onChangeText={setEditedName}
                  />
                </View>
                <View style={styles.macroGrid}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Calories (kcal)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={editedCalories}
                      onChangeText={setEditedCalories}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Protein (g)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={editedProtein}
                      onChangeText={setEditedProtein}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Carbs (g)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={editedCarbs}
                      onChangeText={setEditedCarbs}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Fat (g)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={editedFat}
                      onChangeText={setEditedFat}
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Ingredients (comma separated)</Text>
                  <TextInput
                    style={styles.input}
                    multiline
                    value={editedIngredients}
                    onChangeText={setEditedIngredients}
                  />
                </View>
                <View style={styles.editActions}>
                  <Pressable style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.saveBtn} onPress={saveEdit}>
                    <Text style={styles.saveText}>Save Corrections</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.foodReport}>
                <View style={styles.macrosRow}>
                  <View style={styles.macroCard}>
                    <Text style={styles.macroNum}>{nutrition?.calories || 0}</Text>
                    <Text style={styles.macroLbl}>Calories</Text>
                  </View>
                  <View style={[styles.macroCard, { borderTopColor: colors.accentBlue || '#5B8DEF', borderTopWidth: 3 }]}>
                    <Text style={[styles.macroNum, { color: colors.accentBlue || '#5B8DEF' }]}>
                      {nutrition?.protein_g || 0}g
                    </Text>
                    <Text style={styles.macroLbl}>Protein</Text>
                  </View>
                  <View style={[styles.macroCard, { borderTopColor: colors.accentOrange || '#E2A05C', borderTopWidth: 3 }]}>
                    <Text style={[styles.macroNum, { color: colors.accentOrange || '#E2A05C' }]}>
                      {nutrition?.carbs_g || 0}g
                    </Text>
                    <Text style={styles.macroLbl}>Carbs</Text>
                  </View>
                  <View style={[styles.macroCard, { borderTopColor: colors.accentCoral || '#D95C67', borderTopWidth: 3 }]}>
                    <Text style={[styles.macroNum, { color: colors.accentCoral || '#D95C67' }]}>
                      {nutrition?.fat_g || 0}g
                    </Text>
                    <Text style={styles.macroLbl}>Fat</Text>
                  </View>
                </View>

                {foodData.visibleIngredients && foodData.visibleIngredients.length > 0 && (
                  <View style={styles.ingredientsCard}>
                    <Text style={styles.ingredientsTitle}>Visible Ingredients</Text>
                    <Text style={styles.ingredientsList}>
                      {foodData.visibleIngredients.join(', ')}
                    </Text>
                  </View>
                )}

                <Pressable style={styles.correctionLink} onPress={startEdit}>
                  <Ionicons name="create-outline" size={16} color={colors.accentPurple || '#7C6CD0'} />
                  <Text style={styles.correctionLinkText}>Correct Calories or Macros</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Translation Results */}
        {visualResult.defaultTranslation && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Translation</Text>
            <View style={styles.translationCard}>
              <View style={styles.translationRow}>
                <Text style={styles.translationLang}>
                  {visualResult.detectedLanguage?.name || visualResult.defaultTranslation.sourceLanguage || 'Original'}
                </Text>
                <Text style={styles.translationText}>{visualResult.defaultTranslation.sourceText}</Text>
              </View>
              <View style={styles.translationDivider} />
              <View style={styles.translationRow}>
                <Text style={styles.translationLangActive}>
                  {visualResult.defaultTranslation.targetLanguage.toUpperCase()}
                </Text>
                <Text style={styles.translationTextActive}>{visualResult.defaultTranslation.translatedText}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ProductPackage Details */}
        {visualResult.product && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Product Details</Text>
            <View style={styles.productCard}>
              <Text style={styles.productBrand}>{visualResult.product.brand || 'Brand Unknown'}</Text>
              <Text style={styles.productName}>{visualResult.product.name}</Text>
              {visualResult.product.visibleClaims && visualResult.product.visibleClaims.length > 0 && (
                <View style={styles.claimsList}>
                  {visualResult.product.visibleClaims.map((claim, i) => (
                    <View key={i} style={styles.claimTag}>
                      <Ionicons name="checkmark-circle-outline" size={14} color={colors.accentGreen} />
                      <Text style={styles.claimText}>{claim}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action Controls */}
        <View style={styles.actionRow}>
          <Pressable style={styles.retakeBtn} onPress={onRetake}>
            <Ionicons name="refresh" size={18} color={colors.textPrimary} />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </Pressable>
          <Pressable style={styles.followUpBtn} onPress={() => setCameraState('follow_up')}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.followUpBtnText}>Ask Follow-up</Text>
          </Pressable>
          <Pressable style={styles.doneBtn} onPress={onDone}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
      web: {
        boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
      },
    }),
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.backgroundSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  summary: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  spokenCard: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  spokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  spokenTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 8,
    flex: 1,
  },
  speakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  speakText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  stopBtn: {
    backgroundColor: colors.error,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  stopText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  spokenBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  transcriptControls: {
    flexDirection: 'row',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  iconControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  foodReport: {
    gap: 12,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  macroCard: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  macroNum: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  macroLbl: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  ingredientsCard: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ingredientsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  ingredientsList: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  correctionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  correctionLinkText: {
    fontSize: 13,
    color: colors.accentPurple,
    fontWeight: '600',
  },
  translationCard: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  translationRow: {
    paddingVertical: 4,
  },
  translationLang: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  translationLangActive: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentPurple,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  translationText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  translationTextActive: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  translationDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  productCard: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  productBrand: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  claimsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  claimTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  claimText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  editCard: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  retakeBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  followUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  followUpBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  doneBtn: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
