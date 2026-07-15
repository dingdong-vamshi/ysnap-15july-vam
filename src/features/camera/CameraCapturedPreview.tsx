import React from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { useCameraState } from './cameraState';

export const CameraCapturedPreview: React.FC = () => {
  const { cameraState, capturedImageUri } = useCameraState();

  const isVisible = [
    'captured',
    'preparing',
    'analysing',
    'result',
    'speaking',
    'follow_up',
    'error',
  ].includes(cameraState);

  if (!isVisible || !capturedImageUri) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri: capturedImageUri }}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
});
