import React from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LanguageSelector } from './LanguageSelector';
import { LanguageSwapButton } from './LanguageSwapButton';
import { colors, spacing } from '@/constants';

interface LanguagePairSelectorProps {
  sourceLanguageCode: string;
  sourceLanguageName: string;
  targetLanguageCode: string;
  targetLanguageName: string;
  onSourcePress: () => void;
  onTargetPress: () => void;
  onSwap: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export const LanguagePairSelector: React.FC<LanguagePairSelectorProps> = ({
  sourceLanguageCode,
  sourceLanguageName,
  targetLanguageCode,
  targetLanguageName,
  onSourcePress,
  onTargetPress,
  onSwap,
  disabled = false,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.selectorWrapper}>
        <LanguageSelector
          languageCode={sourceLanguageCode}
          languageName={sourceLanguageName}
          onPress={onSourcePress}
          disabled={disabled}
        />
      </View>

      <LanguageSwapButton onSwap={onSwap} disabled={disabled} />

      <View style={styles.selectorWrapper}>
        <LanguageSelector
          languageCode={targetLanguageCode}
          languageName={targetLanguageName}
          onPress={onTargetPress}
          disabled={disabled}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    width: '100%',
  },
  selectorWrapper: {
    flex: 1,
  },
});
