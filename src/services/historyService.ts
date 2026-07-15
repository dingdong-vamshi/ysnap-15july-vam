import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export interface ActivityHistory {
  id: string;
  user_id: string;
  client_request_id: string;
  tool: 'type' | 'voice' | 'camera' | 'conversation' | 'accent_changer' | 'voice_clone';
  operation_type: string;
  title?: string;
  source_language?: string;
  target_language?: string;
  source_text?: string;
  translated_text?: string;
  transcript?: any;
  metadata?: any;
  duration_seconds?: number;
  input_asset_path?: string;
  output_asset_path?: string;
  thumbnail_path?: string;
  created_at?: string;
  updated_at?: string;
}

export const historyService = {
  /**
   * Create an activity history record in Supabase
   */
  async createActivity(activity: Omit<Partial<ActivityHistory>, 'user_id'> & { client_request_id: string; tool: ActivityHistory['tool']; operation_type: string }): Promise<ActivityHistory> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User must be authenticated to create activity history.');

    const { data, error } = await supabase
      .from('activity_history')
      .insert({
        user_id: user.id,
        ...activity,
      } as any)
      .select()
      .single();

    if (error) {
      // If it's a duplicate request ID, we gracefully return the existing record if found,
      // or throw the original error.
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('activity_history')
          .select('*')
          .eq('user_id', user.id)
          .eq('client_request_id', activity.client_request_id)
          .maybeSingle();
        if (existing) return existing as ActivityHistory;
      }
      throw error;
    }

    return data as ActivityHistory;
  },

  /**
   * List activity history records with filters and pagination
   */
  async listActivities(options: {
    tool?: ActivityHistory['tool'];
    operation_type?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ActivityHistory[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('activity_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (options.tool) {
      query = query.eq('tool', options.tool);
    }
    if (options.operation_type) {
      query = query.eq('operation_type', options.operation_type);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ActivityHistory[];
  },

  /**
   * Fetch a single activity by ID
   */
  async getActivity(id: string): Promise<ActivityHistory | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('activity_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data as ActivityHistory | null;
  },

  /**
   * Update an activity by ID
   */
  async updateActivity(id: string, updates: Partial<Omit<ActivityHistory, 'id' | 'user_id' | 'client_request_id'>>): Promise<ActivityHistory> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await (supabase as any)
      .from('activity_history')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data as ActivityHistory;
  },

  /**
   * Delete an activity and its associated storage files
   */
  async deleteActivity(id: string): Promise<{ success: boolean; storageCleaned: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Fetch activity to check ownership and gather file paths
    const activity = await this.getActivity(id);
    if (!activity) {
      return { success: false, storageCleaned: false, error: 'Activity not found' };
    }
    if (activity.user_id !== user.id) {
      throw new Error('Unauthorized deletion attempt.');
    }

    // 2. Collect paths to delete
    const filesToDelete: string[] = [];
    if (activity.input_asset_path) filesToDelete.push(activity.input_asset_path);
    if (activity.output_asset_path) filesToDelete.push(activity.output_asset_path);
    if (activity.thumbnail_path) filesToDelete.push(activity.thumbnail_path);

    let storageCleaned = true;

    // 3. Delete files from history-files bucket
    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('history-files')
        .remove(filesToDelete as any);

      if (storageError) {
        console.warn('Storage file deletion warning/partial cleanup:', storageError.message);
        storageCleaned = false;
      }
    }

    // 4. Delete the database row
    const { error: dbError } = await supabase
      .from('activity_history')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (dbError) {
      throw dbError;
    }

    return { success: true, storageCleaned };
  },

  /**
   * Helper to upload a file to the private history-files bucket
   */
  async uploadFile(tool: ActivityHistory['tool'], activityId: string, filename: string, file: Blob | ArrayBuffer, contentType: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated.');

    // Storage path structure: <user-id>/<tool>/<activity-id>/<safe-filename>
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${tool}/${activityId}/${sanitizedFilename}`;

    const { data, error } = await supabase.storage
      .from('history-files')
      .upload(filePath, file, {
        contentType,
        upsert: false,
      });

    if (error) throw error;
    return data.path;
  },

  /**
   * Helper to fetch short-lived signed URL for a file path
   */
  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('history-files')
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      console.error('Error generating signed URL:', error.message);
      return null;
    }
    return data?.signedUrl || null;
  },

  /**
   * Export activity details (metadata TXT/JSON or Audio)
   */
  async exportActivity(activity: ActivityHistory, mode: 'text' | 'audio' = 'text'): Promise<void> {
    const dateStr = activity.created_at ? new Date(activity.created_at).toISOString().split('T')[0] : 'unknown';
    const shortId = activity.id ? activity.id.slice(0, 8) : 'export';

    if (mode === 'audio') {
      const audioPath = activity.output_asset_path || activity.input_asset_path;
      if (!audioPath) throw new Error('No audio asset available to export.');
      
      const filename = `ysnap-${activity.tool}-${dateStr}-${shortId}.mp3`;
      await downloadAudioFile(filename, audioPath);
      return;
    }

    // Default metadata text export
    let content = `YSNAP ${activity.tool.toUpperCase()} EXPORT\n`;
    content += `Date: ${activity.created_at || ''}\n`;
    content += `Operation: ${activity.operation_type}\n`;
    content += `------------------------------------\n`;

    if (activity.source_text) {
      content += `Original Text (${activity.source_language || 'Auto'}):\n${activity.source_text}\n\n`;
    }
    if (activity.translated_text) {
      content += `Translated Text (${activity.target_language || ''}):\n${activity.translated_text}\n\n`;
    }
    if (activity.tool === 'conversation' && activity.transcript) {
      content += `Conversation Transcript:\n`;
      const turns = Array.isArray(activity.transcript) ? activity.transcript : [];
      turns.forEach((t: any, i: number) => {
        content += `[Turn ${i + 1}] Speaker ${t.speaker || 'Unknown'} (${t.language || ''}):\n`;
        content += `Source: ${t.source_text}\n`;
        if (t.translated_text) content += `Translation: ${t.translated_text}\n`;
        content += `\n`;
      });
    }
    if (activity.tool === 'camera' && activity.metadata?.food_info) {
      const food = activity.metadata.food_info;
      content += `Food Scan Details:\n`;
      content += `Meal: ${food.translatedName || food.name}\n`;
      content += `Calories: ${food.calories} kcal\n`;
      content += `Protein: ${food.protein}g\n`;
      content += `Carbohydrates: ${food.carbs}g\n`;
      content += `Fats: ${food.fat}g\n`;
      if (food.allergens && food.allergens.length > 0) {
        content += `Allergen Warnings: ${food.allergens.join(', ')}\n`;
      }
    }

    const filename = `ysnap-${activity.tool}-${dateStr}-${shortId}.txt`;
    await downloadTextFile(filename, content);
  }
};

/**
 * Text Download helper
 */
async function downloadTextFile(filename: string, content: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      throw new Error('Sharing capability is unavailable on this platform.');
    }
  }
}

/**
 * Audio Download helper
 */
async function downloadAudioFile(filename: string, storagePath: string): Promise<void> {
  const signedUrl = await historyService.getSignedUrl(storagePath);
  if (!signedUrl) throw new Error('Failed to generate download link for this audio.');

  if (Platform.OS === 'web') {
    const res = await fetch(signedUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    const downloadRes = await FileSystem.downloadAsync(signedUrl, fileUri);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloadRes.uri);
    } else {
      throw new Error('Sharing capability is unavailable on this platform.');
    }
  }
}
