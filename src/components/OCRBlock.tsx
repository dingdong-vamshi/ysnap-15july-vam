import React from 'react';
import {
  StyleSheet,
  Pressable,
  Text,
  View,
} from 'react-native';
import { colors, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

export interface OCRBlockData {
  id: string;
  text: string;
  translatedText?: string;
  boundingBox: {
    x: number; // percentage (0 - 100) or absolute position
    y: number;
    width: number;
    height: number;
  };
}

interface OCRBlockProps {
  block: OCRBlockData;
  onPress: (block: OCRBlockData) => void;
  selected: boolean;
}

export const OCRBlock: React.FC<OCRBlockProps> = ({
  block,
  onPress,
  selected,
}) => {
  const { x, y, width, height } = block.boundingBox;

  const handlePress = () => {
    triggerHaptic('selection');
    onPress(block);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.blockOverlay,
        {
          left: `${x}%`,
          top: `${y}%`,
          width: `${width}%`,
          height: `${height}%`,
        },
        selected ? styles.selectedBlock : styles.unselectedBlock,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Detected text: ${block.text}. ${
        block.translatedText ? `Translation: ${block.translatedText}` : ''
      }`}
    >
      {selected && block.translatedText ? (
        <View style={styles.translationPill}>
          <Text style={styles.pillText} numberOfLines={2}>
            {block.translatedText}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  blockOverlay: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unselectedBlock: {
    borderColor: 'rgba(255, 255, 255, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedBlock: {
    borderColor: colors.accentPurple,
    backgroundColor: 'rgba(124, 108, 208, 0.25)',
    borderWidth: 2,
    zIndex: 10,
  },
  translationPill: {
    position: 'absolute',
    bottom: '105%',
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    minWidth: 80,
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  pillText: {
    ...typography.smallMedium,
    color: colors.textInverse,
    fontSize: 11,
    textAlign: 'center',
  },
});
export default OCRBlock;
