import React from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import { spacing } from '../constants/spacing';
import { colors } from '../constants/colors';

interface ResponsiveOnboardingLayoutProps {
  children: React.ReactNode;
}

export function ResponsiveOnboardingLayout({ children }: ResponsiveOnboardingLayoutProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const childrenArray = React.Children.toArray(children);
  if (childrenArray.length <= 1) {
    return <>{children}</>;
  }

  const illustration = childrenArray[0];
  const content = childrenArray.slice(1);

  if (isDesktop) {
    return (
      <View style={styles.desktopWrapper}>
        <View style={styles.leftColumn}>
          {React.cloneElement(illustration as React.ReactElement<{ height?: number }>, { height: 460 })}
        </View>
        <View style={styles.rightColumn}>
          <View style={styles.contentInner}>
            {content}
          </View>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  desktopWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    gap: 48,
    paddingVertical: 20,
  },
  leftColumn: {
    flex: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightColumn: {
    flex: 48,
    justifyContent: 'center',
  },
  contentInner: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'flex-start',
  },
});
