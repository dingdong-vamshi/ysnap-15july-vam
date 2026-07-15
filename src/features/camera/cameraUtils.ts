import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(
  sizeBytes: number,
  mimeType?: string
): ImageValidationResult {
  if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Image is too large. Maximum supported size is 10MB.',
    };
  }

  if (mimeType) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
    const isAllowed = allowed.some((type) => mimeType.toLowerCase().includes(type) || type.toLowerCase().includes(mimeType.toLowerCase()));
    if (!isAllowed) {
      return {
        valid: false,
        error: 'Unsupported format. Please select a JPG, PNG, or WebP image.',
      };
    }
  }

  return { valid: true };
}

/**
 * Converts a URI (local filepath or blob URL) to a base64 string.
 */
export async function uriToBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Split on comma to get just the base64 payload
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    // Native
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  }
}
