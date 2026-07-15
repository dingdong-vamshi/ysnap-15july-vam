import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions, FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { colors } from '@/constants/colors';
import { spacing, layout, shadows } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getLanguageName } from '@/constants/languages';
import { generateUUID } from '../../utils/uuid';
import { useCreateActivity, useActivityHistoryList, useDeleteActivity } from '../../hooks/useActivityHistory';
import { historyService } from '../../services/historyService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type CameraMode = 'ocr' | 'food' | 'menu';

export default function CameraScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentRequestId, setCurrentRequestId] = useState(generateUUID());
  const [historyVisible, setHistoryVisible] = useState(false);

  const createActivityMutation = useCreateActivity();
  const deleteActivityMutation = useDeleteActivity();
  const { data: history = [], isLoading: loadingHistory } = useActivityHistoryList({ tool: 'camera', limit: 5 });

  // Permissions hook
  const [permission, requestPermission] = useCameraPermissions();

  // Camera Settings
  const [mode, setMode] = useState<CameraMode>('ocr');
  const [flash, setFlash] = useState<FlashMode>('off');
  const cameraRef = useRef<any>(null);

  // Flow State
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Gemini vision analysis returned by the authenticated Edge Function.
  const [analysisResult, setAnalysisResult] = useState<{
    originalText: string;
    translatedText: string;
    foodInfo?: {
      name: string;
      translatedName: string;
      calories: number;
      protein: string;
      carbs: string;
      fat: string;
      allergens: string[];
      confidence: number;
    };
    ocrBoxes?: Array<{ text: string; translated: string; x: number; y: number; w: number; h: number }>;
  } | null>(null);

  const { data: profile } = useQuery<any>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('primary_target_language').eq('id', user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });
  const targetLanguage = profile?.primary_target_language || 'en';

  const saveBookmarkMutation = useMutation<any, any, void>({
    mutationFn: async () => {
      if (!user || !analysisResult) throw new Error('No analysis result to save');
      const { data, error } = await supabase.from('bookmarks').insert({
        user_id: user.id,
        source_text: analysisResult.foodInfo ? analysisResult.foodInfo.name : analysisResult.originalText,
        translated_text: analysisResult.foodInfo ? analysisResult.foodInfo.translatedName : analysisResult.translatedText,
        source_language: 'auto',
        target_language: 'en',
        tags: [mode],
        note: mode === 'food' ? `Calories: ${analysisResult.foodInfo?.calories} kcal` : 'OCR Scan',
      } as any);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Added translation to bookmarks folder.');
    },
    onError: (err) => {
      Alert.alert('Error', err.message);
    },
  });

  const navigation = useNavigation();
  const [isFocused, setIsFocused] = useState(navigation.isFocused());

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation]);

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    const cannotAskAgain = !permission.canAskAgain;
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={colors.disabled} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSubtitle}>
          {cannotAskAgain
            ? "Camera access was permanently denied. Please enable it in Settings to translate menus, signs, or products."
            : "We need permission to use the camera to translate menus, text, and scan food products."}
        </Text>
        <TouchableOpacity 
          style={styles.primaryBtn} 
          onPress={cannotAskAgain ? () => Linking.openSettings() : requestPermission}
        >
          <Text style={styles.primaryBtnText}>
            {cannotAskAgain ? "Open Settings" : "Grant Permission"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Flash Toggle
  const toggleFlash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  // Capture Image
  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setIsProcessing(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      await processImage(photo.uri, 'image/jpeg');
    } catch (err) {
      console.error('Capture error:', err);
      setIsProcessing(false);
      Alert.alert('Camera Error', err instanceof Error ? err.message : 'Could not capture this image.');
    }
  };

  // Launch Gallery
  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await processImage(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
      }
    } catch (err) {
      console.log('Image picker error:', err);
    }
  };

  // Process Captured/Picked Image
  const processImage = async (uri: string, mimeType = 'image/jpeg') => {
    if (!user) {
      setIsProcessing(false);
      Alert.alert('Sign In Required', 'Sign in to use camera translation.');
      return;
    }
    setCapturedImage(uri);
    setIsProcessing(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, `camera.${blob.type.includes('png') ? 'png' : 'jpg'}`);
      } else {
        formData.append('file', { uri, name: 'camera.jpg', type: mimeType } as any);
      }
      formData.append('target', targetLanguage);
      formData.append('mode', mode);

      const { data, error } = await callEdgeFunction<any>('analyse-image', formData);
      if (error || !data) throw error || new Error('The camera analysis returned no result.');

      const food = data.food_info;
      const resVal = {
        originalText: data.ocr_text || food?.name || data.analysis || 'No readable text detected',
        translatedText: data.translated_text || food?.translated_name || data.analysis || '',
        foodInfo: food ? {
          name: food.name || data.ocr_text || 'Detected food',
          translatedName: food.translated_name || data.translated_text || food.name || 'Detected food',
          calories: Number(food.calories || 0),
          protein: food.protein || 'Unknown',
          carbs: food.carbs || 'Unknown',
          fat: food.fat || 'Unknown',
          allergens: Array.isArray(food.allergens) ? food.allergens : [],
          confidence: Math.round(Number(food.confidence || 0)),
        } : undefined,
        ocrBoxes: Array.isArray(data.ocr_boxes) ? data.ocr_boxes.map((box: any) => ({
          text: String(box.text || ''),
          translated: String(box.translated || ''),
          x: Number(box.x || 0) * 0.36,
          y: Number(box.y || 0) * 0.64,
          w: Number(box.width || 0) * 0.36,
          h: Number(box.height || 0) * 0.64,
        })) : [],
      };
      setAnalysisResult(resVal);

      // Save to unified activity_history in Supabase
      if (user) {
        try {
          const titleText = mode === 'food' 
            ? `Food Scan: ${food?.translated_name || food?.name || 'Detected food'}`
            : mode === 'menu' 
              ? 'Menu Scan Translation' 
              : 'OCR Text Scan Translation';

          const activity = await createActivityMutation.mutateAsync({
            client_request_id: currentRequestId,
            tool: 'camera',
            operation_type: mode,
            title: titleText,
            source_text: resVal.originalText,
            translated_text: resVal.translatedText,
            metadata: {
              mode,
              confidence: food?.confidence ? Math.round(Number(food.confidence)) : undefined,
              calories: food?.calories ? Number(food.calories) : undefined,
              protein: food?.protein || undefined,
              carbs: food?.carbs || undefined,
              fat: food?.fat || undefined,
              allergens: food?.allergens || undefined,
            }
          });

          // Upload local captured/picked image file to history-files storage
          const imgResponse = await fetch(uri);
          const imgBlob = await imgResponse.blob();
          const imgPath = await historyService.uploadFile('camera', activity.id, 'captured.jpg', imgBlob, mimeType);

          await historyService.updateActivity(activity.id, {
            input_asset_path: imgPath,
          });
        } catch (historyErr) {
          console.warn('Failed to save camera scan to unified history or upload image:', historyErr);
        }
      }

      // Generate a fresh request ID for the next capture
      setCurrentRequestId(generateUUID());

      queryClient.invalidateQueries({ queryKey: ['recentSessions', user.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error(error);
      setAnalysisResult(null);
      Alert.alert('Camera Translation Error', error instanceof Error ? error.message : 'Failed to analyze this image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCapturedImage(null);
    setAnalysisResult(null);
    setIsProcessing(false);
  };

  const handleCopyText = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const textToCopy = analysisResult?.foodInfo
      ? `${analysisResult.foodInfo.name} -> ${analysisResult.foodInfo.translatedName}`
      : analysisResult?.translatedText;
    Alert.alert('Copied to Clipboard', textToCopy);
  };

  const handleSelectHistoryItem = async (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHistoryVisible(false);
    
    // Set Mode
    if (item.operation_type === 'food' || item.operation_type === 'menu' || item.operation_type === 'ocr') {
      setMode(item.operation_type as CameraMode);
    }
    
    // Set Analysis Result
    setAnalysisResult({
      originalText: item.source_text || '',
      translatedText: item.translated_text || '',
      foodInfo: item.operation_type === 'food' ? {
        name: item.source_text || '',
        translatedName: item.translated_text || '',
        calories: Number(item.metadata?.calories || 0),
        protein: item.metadata?.protein || 'Unknown',
        carbs: item.metadata?.carbs || 'Unknown',
        fat: item.metadata?.fat || 'Unknown',
        allergens: Array.isArray(item.metadata?.allergens) ? item.metadata?.allergens : [],
        confidence: Number(item.metadata?.confidence || 100),
      } : undefined,
      ocrBoxes: []
    });

    // Set Captured Image
    if (item.input_asset_path) {
      try {
        const url = await historyService.getSignedUrl(item.input_asset_path);
        if (url) {
          setCapturedImage(url);
        }
      } catch (err) {
        console.warn('Failed to load history image asset:', err);
        setCapturedImage(null);
      }
    } else {
      setCapturedImage(null);
    }
  };

  const handleDeleteHistoryItem = (itemId: string) => {
    Alert.alert(
      'Delete History Item',
      'Are you sure you want to delete this scan from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await deleteActivityMutation.mutateAsync(itemId);
              Alert.alert('Success', 'History item deleted.');
            } catch (err: any) {
              Alert.alert('Deletion Error', err.message || 'Failed to delete history item.');
            }
          }
        }
      ]
    );
  };

  const handleExportHistoryItem = async (item: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await historyService.exportActivity(item);
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export scan.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Scan & translate</Text>
          <Text style={styles.headerSubtitle}>Auto detect → {getLanguageName(targetLanguage)}</Text>
        </View>
        <TouchableOpacity style={styles.flashBtn} onPress={toggleFlash} disabled={!!capturedImage}>
          <Ionicons
            name={flash === 'on' ? 'flash' : 'flash-off-outline'}
            size={22}
            color={flash === 'on' ? colors.accentOrange : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Mode Selector Tab */}
      {!capturedImage && (
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'ocr' && styles.modeTabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setMode('ocr');
            }}
          >
            <Ionicons name="text-outline" size={16} color={colors.textPrimary} />
            <Text style={[styles.modeTabText, mode === 'ocr' && styles.modeTabTextActive]}>Text</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, mode === 'food' && styles.modeTabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setMode('food');
            }}
          >
            <Ionicons name="nutrition-outline" size={16} color={colors.textPrimary} />
            <Text style={[styles.modeTabText, mode === 'food' && styles.modeTabTextActive]}>Nutrition</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, mode === 'menu' && styles.modeTabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setMode('menu');
            }}
          >
            <Ionicons name="restaurant-outline" size={16} color={colors.textPrimary} />
            <Text style={[styles.modeTabText, mode === 'menu' && styles.modeTabTextActive]}>Menu</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Viewfinder / Preview Screen */}
      <View style={styles.viewfinderContainer}>
        {capturedImage ? (
          /* PREVIEW STATE */
          <View style={styles.previewWrapper}>
            <Image source={{ uri: capturedImage }} style={styles.previewImage} resizeMode="cover" />

            {/* OCR Bounding Boxes Highlight */}
            {analysisResult && (mode === 'ocr' || mode === 'menu') && (
              <View style={styles.ocrOverlay}>
                {analysisResult.ocrBoxes?.map((box, index) => (
                  <View
                    key={index}
                    style={[
                      styles.ocrBox,
                      {
                        left: `${(box.x / 360) * 100}%`,
                        top: `${(box.y / 480) * 100}%`,
                        width: `${(box.w / 360) * 100}%`,
                        height: `${(box.h / 480) * 100}%`,
                      },
                    ]}
                  >
                    <Text style={styles.ocrBoxLabel}>{box.translated}</Text>
                  </View>
                ))}
              </View>
            )}

            {isProcessing && (
              <View style={styles.processingMask}>
                <ActivityIndicator size="large" color={colors.background} />
                <Text style={styles.processingText}>AI Scanning image...</Text>
              </View>
            )}
          </View>
        ) : (
          /* CAMERA VIEW STATE */
          isFocused ? (
            <CameraView style={styles.cameraView} flash={flash} ref={cameraRef} facing="back">
              <View style={styles.overlayFrameContainer}>
                {mode === 'ocr' && (
                  <View style={styles.textTargetFrame}>
                    <Text style={styles.targetFrameLabel}>ALIGN TEXT HERE</Text>
                  </View>
                )}
                {mode === 'food' && (
                  <View style={styles.foodTargetFrame}>
                    <Text style={styles.targetFrameLabel}>CENTER MEAL / BARCODE</Text>
                  </View>
                )}
                {mode === 'menu' && (
                  <View style={styles.menuTargetFrame}>
                    <Text style={styles.targetFrameLabel}>FIT MENU SECTION</Text>
                  </View>
                )}
              </View>
            </CameraView>
          ) : (
            <View style={[styles.cameraView, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.textPrimary }]}>
              <ActivityIndicator color={colors.background} />
            </View>
          )
        )}
      </View>

      {/* Analysis Details Panel */}
      {analysisResult && (
        <ScrollView style={styles.resultsSheet} contentContainerStyle={styles.resultsSheetContent} showsVerticalScrollIndicator={false}>
          {mode === 'food' && analysisResult.foodInfo ? (
            /* FOOD ANALYSIS SCREEN DISPLAY */
            <View style={styles.foodReportCard}>
              <View style={styles.foodReportHeader}>
                <View style={styles.foodTitleRow}>
                  <Text style={styles.foodReportTitle}>{analysisResult.foodInfo.translatedName}</Text>
                  <Text style={styles.foodReportSubTitle}>Original: {analysisResult.foodInfo.name}</Text>
                </View>
                <View style={styles.matchBadge}>
                  <Text style={styles.matchBadgeText}>{analysisResult.foodInfo.confidence}% Match</Text>
                </View>
              </View>

              {/* Nutrition breakdown grids */}
              <View style={styles.macroRow}>
                <View style={styles.macroItem}>
                  <Text style={styles.macroValue}>{analysisResult.foodInfo.calories}</Text>
                  <Text style={styles.macroLabel}>CALORIES</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={[styles.macroValue, { color: colors.accentBlue }]}>{analysisResult.foodInfo.protein}</Text>
                  <Text style={styles.macroLabel}>PROTEIN</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={[styles.macroValue, { color: colors.accentOrange }]}>{analysisResult.foodInfo.carbs}</Text>
                  <Text style={styles.macroLabel}>CARBS</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={[styles.macroValue, { color: colors.accentCoral }]}>{analysisResult.foodInfo.fat}</Text>
                  <Text style={styles.macroLabel}>FAT</Text>
                </View>
              </View>

              {/* Allergens Warn Card */}
              <View style={styles.allergenAlertCard}>
                <Ionicons name="warning-outline" size={16} color={colors.warning} />
                <Text style={styles.allergenAlertText}>
                  Allergen Warnings: {analysisResult.foodInfo.allergens.join(', ')}
                </Text>
              </View>

              <Text style={styles.analysisDescText}>
                Translation Estimate based on AI image profiling. Actual nutritional contents may vary depending on ingredients and portion size.
              </Text>
            </View>
          ) : (
            /* OCR TEXT RESULTS SCREEN DISPLAY */
            <View style={styles.textReportCard}>
              <Text style={styles.sectionLabel}>DETECTED TEXT</Text>
              <Text style={styles.ocrSourceText}>{analysisResult.originalText}</Text>
              <Ionicons name="arrow-down" size={18} color={colors.textMuted} style={styles.textArrow} />
              <Text style={styles.sectionLabel}>{getLanguageName(targetLanguage).toUpperCase()} TRANSLATION</Text>
              <Text style={styles.ocrTranslatedText}>{analysisResult.translatedText}</Text>
            </View>
          )}

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtnOutline} onPress={handleCopyText}>
              <Ionicons name="copy-outline" size={20} color={colors.primary} />
              <Text style={styles.actionBtnTextOutline}>Copy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtnOutline} onPress={() => saveBookmarkMutation.mutate()}>
              <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
              <Text style={styles.actionBtnTextOutline}>Bookmark</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleReset}>
              <Ionicons name="refresh" size={20} color={colors.textInverse} />
              <Text style={styles.actionBtnTextPrimary}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Capture Controls Footer */}
      {!analysisResult && !isProcessing && (
        <View style={styles.captureFooter}>
          <TouchableOpacity style={styles.galleryBtn} onPress={handlePickImage} disabled={isProcessing}>
            <Ionicons name="images-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          {capturedImage ? (
            /* Retake Button */
            <TouchableOpacity style={styles.retakeBtn} onPress={handleReset}>
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            /* Main Capture Trigger Button */
            <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
              <View style={styles.captureInnerCircle} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.historyBtn} onPress={() => setHistoryVisible(true)}>
            <Ionicons name="time-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* History Slide-up Modal */}
      <Modal
        visible={historyVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recent Camera Scans</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {loadingHistory ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
              ) : history && history.length > 0 ? (
                history.map((item) => (
                  <View key={item.id} style={styles.historyCard}>
                    <TouchableOpacity style={styles.historyCardBody} onPress={() => handleSelectHistoryItem(item)}>
                      <View style={styles.historyCardHeader}>
                        <Text style={styles.historyCardMeta}>
                          {item.operation_type?.toUpperCase() || 'SCAN'}
                        </Text>
                        <Text style={styles.historyCardTime}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                        </Text>
                      </View>
                      <Text style={styles.historySourceText} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.historyTranslatedText} numberOfLines={1}>
                        {item.translated_text || ''}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.historyCardActions}>
                      <TouchableOpacity style={styles.historyActionBtn} onPress={() => handleExportHistoryItem(item)}>
                        <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.historyActionBtn} onPress={() => handleDeleteHistoryItem(item.id)}>
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyHistoryText}>No recent scans in history.</Text>
              )}
            </ScrollView>
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
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.pageMargin,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    ...typography.heading2,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  permissionSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    height: layout.buttonHeight,
    borderRadius: layout.buttonRadius,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  primaryBtnText: {
    ...typography.button,
    color: colors.textInverse,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.heading2,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  flashBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSoft,
    padding: 4,
    marginHorizontal: layout.pageMargin,
    marginVertical: spacing.sm,
    borderRadius: 14,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: colors.surface,
  },
  modeTabText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  modeTabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  viewfinderContainer: {
    flex: 1.5,
    marginHorizontal: 0,
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 0,
    backgroundColor: colors.textPrimary,
  },
  cameraView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayFrameContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textTargetFrame: {
    width: SCREEN_WIDTH * 0.75,
    height: 140,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accentBlue,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  foodTargetFrame: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accentGreen,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  menuTargetFrame: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_HEIGHT * 0.35,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accentOrange,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  targetFrameLabel: {
    ...typography.captionMedium,
    color: colors.textInverse,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  previewWrapper: {
    flex: 1,
    position: 'relative',
  },
  previewImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  ocrOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  ocrBox: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.accentBlue,
    backgroundColor: 'rgba(91, 141, 239, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  ocrBoxLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.background,
    backgroundColor: colors.accentBlue,
    borderRadius: 3,
    paddingHorizontal: 2,
    overflow: 'hidden',
    textAlign: 'center',
  },
  processingMask: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9, 9, 9, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    ...typography.bodyMedium,
    color: colors.textInverse,
    marginTop: spacing.md,
  },
  resultsSheet: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -18,
  },
  resultsSheetContent: {
    padding: layout.pageMargin,
    paddingTop: spacing.xl,
    paddingBottom: 120,
  },
  textReportCard: {
    backgroundColor: colors.surface,
    padding: layout.cardPadding,
    borderRadius: layout.cardRadius,
    borderWidth: 0,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.smallMedium,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  ocrSourceText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
  },
  ocrTranslatedText: {
    ...typography.heading3,
    color: colors.primary,
    fontSize: 18,
    lineHeight: 24,
  },
  textArrow: {
    alignSelf: 'center',
    marginVertical: spacing.sm,
  },
  foodReportCard: {
    backgroundColor: colors.surface,
    padding: layout.cardPadding,
    borderRadius: layout.cardRadius,
    borderWidth: 0,
    marginBottom: spacing.md,
  },
  foodReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
  },
  foodTitleRow: {
    flex: 1,
    marginRight: spacing.sm,
  },
  foodReportTitle: {
    ...typography.heading3,
    color: colors.textPrimary,
  },
  foodReportSubTitle: {
    ...typography.captionMedium,
    color: colors.textMuted,
    marginTop: 2,
  },
  matchBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success,
  },
  matchBadgeText: {
    ...typography.smallMedium,
    color: colors.success,
    fontSize: 11,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  macroItem: {
    flex: 1,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  macroValue: {
    ...typography.heading4,
    color: colors.textPrimary,
  },
  macroLabel: {
    ...typography.smallMedium,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  allergenAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  allergenAlertText: {
    ...typography.captionMedium,
    color: colors.warning,
    marginLeft: spacing.sm,
    flex: 1,
  },
  analysisDescText: {
    ...typography.small,
    color: colors.textSubtle,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  actionBtnOutline: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    ...shadows.sm,
  },
  actionBtnTextOutline: {
    ...typography.buttonSmall,
    color: colors.textPrimary,
    marginLeft: 6,
  },
  actionBtnPrimary: {
    flex: 1.5,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    ...shadows.md,
  },
  actionBtnTextPrimary: {
    ...typography.buttonSmall,
    color: colors.textInverse,
    marginLeft: 6,
  },
  captureFooter: {
    position: 'absolute',
    bottom: 96,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  galleryBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  captureInnerCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
  },
  retakeBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  spacerBtn: {
    width: 52,
  },
  historyBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalTitle: {
    ...typography.heading3,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  historyList: {
    flex: 1,
  },
  historyContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  historyCard: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyCardBody: {
    flex: 1,
    marginRight: 12,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyCardMeta: {
    fontSize: 11,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted,
  },
  historyCardTime: {
    fontSize: 11,
    fontFamily: typography.captionMedium.fontFamily,
    color: colors.textSubtle,
  },
  historySourceText: {
    fontSize: 14,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  historyTranslatedText: {
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
    color: colors.accentPurple,
  },
  historyCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  historyActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyHistoryText: {
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
    color: colors.textSubtle,
    textAlign: 'center',
    marginTop: 30,
  },
});
