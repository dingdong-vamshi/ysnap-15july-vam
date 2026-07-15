import React from 'react';
import { View, useWindowDimensions, StyleSheet, ScrollView } from 'react-native';
import { spacing, layout } from '../constants/spacing';
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.desktopScrollContent}
        style={styles.desktopScrollView}
      >
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
      </ScrollView>
    );
  }

  // Mobile layout: illustration remains pinned at the top, selectable options scroll below.
  return (
    <View style={styles.mobileContainer}>
      <View style={styles.mobileIllustrationWrapper}>
        {React.cloneElement(illustration as React.ReactElement<{ height?: number }>, { height: 180 })}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.mobileScrollContent}
        style={styles.mobileScrollView}
      >
        <View style={styles.mobileContentInner}>
          {content}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopScrollView: {
    flex: 1,
  },
  desktopScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 100, // Safe distance from footer
  },
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
  mobileContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  mobileIllustrationWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  mobileScrollView: {
    flex: 1,
  },
  mobileScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 140, // Padding for footer
  },
  mobileContentInner: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
});
