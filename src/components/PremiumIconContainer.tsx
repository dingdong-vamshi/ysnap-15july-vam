import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../constants/colors';

interface PremiumIconContainerProps {
  children: React.ReactNode;
  size?: number;
  backgroundColor?: string;
}

export function PremiumIconContainer({
  children,
  size = 64,
  backgroundColor = colors.backgroundSoft,
}: PremiumIconContainerProps) {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: Math.floor(size * 0.32),
          backgroundColor,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
});
