import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { BackButton } from './BackButton';
import { colors, spacing, typography } from '@/constants';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  renderRight?: () => React.ReactNode;
  renderLeft?: () => React.ReactNode;
  containerStyle?: ViewStyle;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBackPress,
  renderRight,
  renderLeft,
  containerStyle,
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.leftContainer}>
        {showBack ? (
          <BackButton onPress={onBackPress} />
        ) : renderLeft ? (
          renderLeft()
        ) : null}
      </View>

      <View style={styles.centerContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightContainer}>
        {renderRight ? renderRight() : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    backgroundColor: colors.background,
    minHeight: 60,
  },
  leftContainer: {
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  rightContainer: {
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  title: {
    ...typography.heading4,
    color: colors.textPrimary,
    textAlign: 'left',
  },
  subtitle: {
    ...typography.smallMedium,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'left',
  },
});
