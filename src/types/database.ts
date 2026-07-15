/**
 * YSnap Database Types — Auto-generated from schema
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_path: string | null;
          native_language: string;
          primary_target_language: string;
          additional_languages: string[];
          translation_purpose: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_path?: string | null;
          native_language?: string;
          primary_target_language?: string;
          additional_languages?: string[];
          translation_purpose?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          auto_playback: boolean;
          playback_speed: number;
          translation_tone: string;
          transliteration_enabled: boolean;
          selected_voice_id: string | null;
          history_enabled: boolean;
          audio_retention_enabled: boolean;
          image_retention_enabled: boolean;
          experimental_realtime: boolean;
          theme: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          auto_playback?: boolean;
          playback_speed?: number;
          translation_tone?: string;
          transliteration_enabled?: boolean;
          selected_voice_id?: string | null;
          history_enabled?: boolean;
          audio_retention_enabled?: boolean;
          image_retention_enabled?: boolean;
          experimental_realtime?: boolean;
          theme?: string;
        };
        Update: Partial<Database['public']['Tables']['user_preferences']['Insert']>;
      };
      translation_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_type: 'text' | 'voice' | 'conversation' | 'camera' | 'live_camera' | 'voice_change' | 'practice';
          source_language: string;
          target_language: string;
          title: string | null;
          status: 'active' | 'completed' | 'failed' | 'cancelled';
          duration_seconds: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_type: string;
          source_language: string;
          target_language: string;
          title?: string | null;
          status?: string;
          duration_seconds?: number | null;
          metadata?: Json;
        };
        Update: Partial<Database['public']['Tables']['translation_sessions']['Insert']>;
      };
      translation_items: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          speaker_id: string | null;
          sequence_number: number;
          source_text: string;
          translated_text: string | null;
          transliteration: string | null;
          detected_language: string | null;
          source_language: string | null;
          target_language: string | null;
          uncertainty: string | null;
          alternatives: Json;
          context_notes: string | null;
          source_audio_path: string | null;
          generated_audio_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          speaker_id?: string | null;
          sequence_number?: number;
          source_text: string;
          translated_text?: string | null;
          transliteration?: string | null;
          detected_language?: string | null;
          source_language?: string | null;
          target_language?: string | null;
          uncertainty?: string | null;
          alternatives?: Json;
          context_notes?: string | null;
          source_audio_path?: string | null;
          generated_audio_path?: string | null;
        };
        Update: Partial<Database['public']['Tables']['translation_items']['Insert']>;
      };
      media_assets: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          media_kind: 'voice_input' | 'voice_output' | 'camera_input' | 'voice_sample' | 'export';
          bucket: string;
          path: string;
          mime_type: string | null;
          size_bytes: number | null;
          retention_policy: 'session' | 'permanent' | 'temporary';
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          media_kind: string;
          bucket: string;
          path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          retention_policy?: string;
        };
        Update: Partial<Database['public']['Tables']['media_assets']['Insert']>;
      };
      conversation_summaries: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          title: string | null;
          summary: string | null;
          key_points: Json;
          questions: Json;
          decisions: Json;
          action_items: Json;
          generated_language: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          title?: string | null;
          summary?: string | null;
          key_points?: Json;
          questions?: Json;
          decisions?: Json;
          action_items?: Json;
          generated_language?: string;
        };
        Update: Partial<Database['public']['Tables']['conversation_summaries']['Insert']>;
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          translation_item_id: string | null;
          source_text: string;
          translated_text: string;
          source_language: string | null;
          target_language: string | null;
          tags: string[];
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          translation_item_id?: string | null;
          source_text: string;
          translated_text: string;
          source_language?: string | null;
          target_language?: string | null;
          tags?: string[];
          note?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bookmarks']['Insert']>;
      };
      voice_profiles: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          provider_voice_id: string | null;
          display_name: string;
          accent_info: string | null;
          is_cloned: boolean;
          status: 'pending' | 'processing' | 'ready' | 'failed' | 'deleted';
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider?: string;
          provider_voice_id?: string | null;
          display_name: string;
          accent_info?: string | null;
          is_cloned?: boolean;
          status?: string;
        };
        Update: Partial<Database['public']['Tables']['voice_profiles']['Insert']>;
      };
      voice_consents: {
        Row: {
          id: string;
          user_id: string;
          voice_profile_id: string;
          consent_version: string;
          ownership_confirmed: boolean;
          privacy_acknowledged: boolean;
          consent_timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          voice_profile_id: string;
          consent_version?: string;
          ownership_confirmed: boolean;
          privacy_acknowledged: boolean;
          consent_timestamp?: string;
        };
        Update: Partial<Database['public']['Tables']['voice_consents']['Insert']>;
      };
      practice_attempts: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          phrase_source: string;
          phrase_target: string;
          source_language: string;
          target_language: string;
          recognized_text: string | null;
          accuracy_score: number | null;
          missing_words: string[];
          extra_words: string[];
          feedback: string | null;
          audio_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          phrase_source: string;
          phrase_target: string;
          source_language: string;
          target_language: string;
          recognized_text?: string | null;
          accuracy_score?: number | null;
          missing_words?: string[];
          extra_words?: string[];
          feedback?: string | null;
          audio_path?: string | null;
        };
        Update: Partial<Database['public']['Tables']['practice_attempts']['Insert']>;
      };
      usage_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: 'transcription' | 'tts' | 'image_analysis' | 'translation' | 'summary' | 'voice_clone' | 'voice_change';
          quantity: number;
          unit: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          quantity?: number;
          unit: string;
          metadata?: Json;
        };
        Update: Partial<Database['public']['Tables']['usage_events']['Insert']>;
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
