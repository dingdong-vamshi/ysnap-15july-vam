import { VisualAnalysisCategory } from '../../services/visualAnalysisService';

export type CameraState =
  | 'idle'
  | 'requesting_permission'
  | 'permission_denied'
  | 'opening_camera'
  | 'ready'
  | 'capturing'
  | 'captured'
  | 'preparing'
  | 'analysing'
  | 'result'
  | 'speaking'
  | 'follow_up'
  | 'error';

export type CameraMode = 'ocr' | 'food' | 'menu';

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
    language?: string;
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
    type?: string;
    description?: string;
    confidence?: number;
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
  };

  food?: {
    name?: string;
    visibleIngredients?: string[];
    visibleNutritionText?: string[];
    estimatedNutrition?: {
      calories?: number;
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
    };
  };

  landmark?: {
    name?: string;
    city?: string;
    country?: string;
    briefHistory?: string;
  };

  defaultTranslation?: {
    sourceLanguage?: string;
    targetLanguage: string;
    sourceText: string;
    translatedText: string;
  };

  spokenSummary: string;
  suggestedActions: string[];
  sources?: Array<{
    title: string;
    url: string;
  }>;
}

export interface FoodCorrectionData {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
}
