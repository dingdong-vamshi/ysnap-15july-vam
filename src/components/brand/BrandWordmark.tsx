import React from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';

interface BrandWordmarkProps {
  color?: string;
  size?: number;
  style?: ViewStyle;
}

export const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  color,
  size = 20,
  style,
}) => {
  const textColor = color || colors.textPrimary;

  return (
    <View style={[styles.container, style]}>
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: size,
          },
        ]}
        accessibilityLabel="YSnap logo wordmark"
      >
        ysnap
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  text: {
    fontFamily: typography.heading1.fontFamily,
    fontWeight: '800',
    letterSpacing: -0.5,
    textTransform: 'lowercase',
  },
});
