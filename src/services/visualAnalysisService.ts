import { callEdgeFunction } from '../lib/supabase';
import { Platform } from 'react-native';

export type VisualAnalysisCategory =
  | 'text'
  | 'document'
  | 'menu'
  | 'landmark'
  | 'food'
  | 'product'
  | 'plant'
  | 'animal'
  | 'object'
  | 'scene'
  | 'unknown';

export interface VisualAnalysisResult {
  category: VisualAnalysisCategory;
  title: string;
  summary: string;
  confidence?: number;

  detectedLanguage?: {
    code?: string;
    name?: string;
    confidence?: number;
  };

  detectedText?: Array<{
    text: string;
    languageCode?: string;
    languageName?: string;
    translatedText?: string;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;

  entities?: Array<{
    name: string;
    category?: string;
    description?: string;
    confidence?: number;
    visibleText?: string;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;

  product?: {
    name?: string;
    brand?: string;
    visibleClaims?: string[];
    packageText?: string[];
  };

  food?: {
    name?: string;
    visibleIngredients?: string[];
    packageClaims?: string[];
    visibleNutritionText?: string[];
  };

  landmark?: {
    name?: string;
    city?: string;
    country?: string;
    briefHistory?: string;
    confidence?: number;
  };

  defaultTranslation?: {
    sourceLanguage?: string;
    targetLanguage: string;
    sourceText: string;
    translatedText: string;
  };

  suggestedActions: Array<
    | 'translate'
    | 'copy_text'
    | 'read_aloud'
    | 'explain'
    | 'identify_product'
    | 'identify_landmark'
    | 'describe_scene'
    | 'ask_follow_up'
  >;

  sources?: Array<{
    title: string;
    url: string;
  }>;

  spokenSummary: string;
}

export const visualAnalysisService = {
  /**
   * Performs analysis on a captured or uploaded image.
   */
  async analyseCapturedImage(
    uriOrBase64: string,
    targetLanguage: string,
    mode: 'ocr' | 'food' | 'menu'
  ): Promise<VisualAnalysisResult> {
    const formData = new FormData();
    if (Platform.OS === 'web') {
      const response = await fetch(uriOrBase64);
      const blob = await response.blob();
      formData.append('file', blob, `camera.${blob.type.includes('png') ? 'png' : 'jpg'}`);
    } else {
      formData.append('file', { uri: uriOrBase64, name: 'camera.jpg', type: 'image/jpeg' } as any);
    }
    formData.append('target', targetLanguage);
    formData.append('mode', mode);

    const { data, error } = await callEdgeFunction<any>('analyse-visual', formData);
    if (error) throw error;
    if (!data) throw new Error('Visual analysis failed to return a response.');
    return data as VisualAnalysisResult;
  },

  /**
   * Retranslates detected text to a new target language.
   */
  async translateDetectedText(
    text: string,
    targetLanguage: string
  ): Promise<string> {
    const { data, error } = await callEdgeFunction<any>('translate-text', {
      text,
      target: targetLanguage
    });
    if (error) throw error;
    return data?.translated_text || '';
  },

  /**
   * Issues an ephemeral session token for Deno's WebSocket proxy to Gemini Live.
   */
  async getLiveSessionToken(): Promise<{ token: string; expires_in: number }> {
    const { data, error } = await callEdgeFunction<any>('create-gemini-live-token', {});
    if (error) throw error;
    if (!data || !data.token) throw new Error('Failed to retrieve Live session token.');
    return data;
  },

  /**
   * Handles short conversational follow-ups for the current image session over HTTP.
   */
  async askVisualFollowUp(
    imageContextBase64: string,
    previousMessages: Array<{ role: 'user' | 'model'; text: string }>,
    question: string
  ): Promise<string> {
    const { data, error } = await callEdgeFunction<any>('visual-follow-up', {
      imageContext: imageContextBase64,
      history: previousMessages,
      question
    });
    if (error) throw error;
    return data?.text || '';
  }
};
