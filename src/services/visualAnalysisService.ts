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

  detectedText?: Array<{
    text: string;
    language?: string;
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
    confidence?: number;
    description?: string;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;

  landmark?: {
    name?: string;
    country?: string;
    city?: string;
    historySummary?: string;
  };

  food?: {
    name?: string;
    visibleIngredients?: string[];
    description?: string;
  };

  suggestedActions: Array<
    | 'translate'
    | 'explain'
    | 'identify'
    | 'read_aloud'
    | 'ask_follow_up'
    | 'search_source'
  >;

  sources?: Array<{
    title: string;
    url: string;
  }>;
}

export const visualAnalysisService = {
  /**
   * Performs analysis on a captured or uploaded image.
   * Currently placeholder throwing a configured error.
   */
  async analyseCapturedImage(
    base64Data: string,
    targetLanguage: string,
    mode: 'ocr' | 'food' | 'menu'
  ): Promise<VisualAnalysisResult> {
    throw new Error('Gemini visual analysis is not configured yet.');
  },

  /**
   * Translates text extracted from the image.
   */
  async translateDetectedText(
    text: string,
    targetLanguage: string
  ): Promise<string> {
    throw new Error('Gemini visual analysis is not configured yet.');
  },

  /**
   * Handles short conversational follow-ups for the current image session.
   */
  async askVisualFollowUp(
    imageContextBase64: string,
    previousMessages: Array<{ role: 'user' | 'model'; text: string }>,
    question: string
  ): Promise<string> {
    throw new Error('Gemini visual analysis is not configured yet.');
  }
};
