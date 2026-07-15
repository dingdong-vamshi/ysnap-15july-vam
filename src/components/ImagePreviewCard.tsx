import React from 'react';
import {
  StyleSheet,
  View,
  Image,
  Pressable,
  Text,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface ImagePreviewCardProps {
  uri: string;
  onRemove?: () => void;
  fileName?: string;
  fileSize?: string;
  style?: ViewStyle;
}

export const ImagePreviewCard: React.FC<ImagePreviewCardProps> = ({
  uri,
  onRemove,
  fileName,
  fileSize,
  style,
}) => {
  const handleRemove = () => {
    triggerHaptic('warning');
    if (onRemove) onRemove();
  };

  return (
    <View style={[styles.card, style]}>
      <Image source={{ uri }} style={styles.image} />
      
      {(fileName || fileSize) ? (
        <View style={styles.infoContainer}>
          {fileName && <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>}
          {fileSize && <Text style={styles.fileSize}>{fileSize}</Text>}
        </View>
      ) : null}

      {onRemove && (
        <Pressable
          onPress={handleRemove}
          style={({ pressed }) => [
            styles.removeBtn,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Remove photo"
        >
          <Feather name="trash-2" size={16} color={colors.error} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 14,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    gap: spacing.sm,
    position: 'relative',
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: colors.backgroundMuted,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
  },
  fileSize: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
});
export default ImagePreviewCard;
