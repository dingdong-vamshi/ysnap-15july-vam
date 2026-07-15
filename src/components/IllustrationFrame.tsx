import React from 'react';
import { StyleSheet, View, Image, ImageSourcePropType, useWindowDimensions } from 'react-native';
import { colors } from '../constants/colors';

const IMAGE_MAP: Record<string, ImageSourcePropType> = {
  'IMG-001': require('../../assets/onboarding/IMG-001.jpg'),
  'IMG-002': require('../../assets/onboarding/IMG-002.jpg'),
  'IMG-003': require('../../assets/onboarding/IMG-003.jpg'),
  'IMG-004': require('../../assets/onboarding/IMG-004.jpg'),
  'IMG-005': require('../../assets/onboarding/IMG-005.jpg'),
  'IMG-006': require('../../assets/onboarding/IMG-006.jpg'),
  'IMG-007': require('../../assets/onboarding/IMG-007.jpg'),
  'IMG-008': require('../../assets/onboarding/IMG-008.jpg'),
  'IMG-009': require('../../assets/onboarding/IMG-009.jpg'),
  'IMG-010': require('../../assets/onboarding/IMG-010.jpg'),
  'IMG-011': require('../../assets/onboarding/IMG-011.jpg'),
  'IMG-012': require('../../assets/onboarding/IMG-012.jpg'),
  'IMG-013': require('../../assets/onboarding/IMG-013.jpg'),
  'IMG-014': require('../../assets/onboarding/IMG-014.jpg'),
  'IMG-015': require('../../assets/onboarding/IMG-015.jpg'),
  'IMG-016': require('../../assets/onboarding/IMG-016.jpg'),
};

interface IllustrationFrameProps {
  imageId: string;
  height?: number;
}

export function IllustrationFrame({ imageId, height }: IllustrationFrameProps) {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 900;

  // Determine height: prioritize explicit height, fallback to dynamic mobile calculation
  const containerHeight = height ?? (isDesktop ? 460 : Math.min(340, Math.round(screenHeight * 0.38)));

  const imageSource = IMAGE_MAP[imageId];

  if (!imageSource) {
    return null;
  }

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      <Image
        source={imageSource}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.backgroundSoft,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
