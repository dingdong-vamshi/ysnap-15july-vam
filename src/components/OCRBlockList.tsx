import React from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { OCRBlock, OCRBlockData } from './OCRBlock';

interface OCRBlockListProps {
  blocks: OCRBlockData[];
  selectedBlockId: string | null;
  onBlockPress: (block: OCRBlockData) => void;
  style?: ViewStyle;
}

export const OCRBlockList: React.FC<OCRBlockListProps> = ({
  blocks,
  selectedBlockId,
  onBlockPress,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {blocks.map((block) => (
        <OCRBlock
          key={block.id}
          block={block}
          selected={block.id === selectedBlockId}
          onPress={onBlockPress}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
});
export default OCRBlockList;
