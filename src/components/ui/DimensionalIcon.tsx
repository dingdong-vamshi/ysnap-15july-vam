import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface DimensionalIconProps {
  icon: React.ReactNode;
  onPress?: () => void;
  size?: number;
  containerSize?: number;
  selected?: boolean;
  active?: boolean;
  disabled?: boolean;
  monochrome?: boolean;
  depth?: number;
  semanticAccent?: string | null; // Keep for compatibility, but we enforce monochrome visual style
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export const DimensionalIcon: React.FC<DimensionalIconProps> = ({
  icon,
  onPress,
  size = 24,
  containerSize = 48,
  selected = false,
  active = false,
  disabled = false,
  monochrome = true, // default to true for premium visual system
  depth = 3,
  semanticAccent = null,
  style,
  accessibilityLabel,
}) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isSelected = selected || active;

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) onPress();
  };

  // Enforce premium monochrome colors
  const containerStyles = [
    styles.container,
    {
      width: containerSize,
      height: containerSize,
      borderRadius: containerSize / 2.8,
    },
    isSelected ? styles.selected : styles.unselected,
    {
      borderBottomWidth: pressed ? 1 : depth,
    },
    pressed && styles.pressed,
    disabled && styles.disabled,
    style,
  ];

  // Clone icon to enforce monochrome colors
  const renderIcon = () => {
    if (React.isValidElement(icon)) {
      const iconColor = isSelected ? '#FFFFFF' : '#000000';
      return React.cloneElement(icon as React.ReactElement<any>, {
        color: iconColor,
      });
    }
    return icon;
  };

  const content = (
    <View style={styles.contentWrapper}>
      {/* Top highlight sheen layer */}
      {!disabled && !pressed && (
        <View 
          style={[
            styles.topSheen, 
            { backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.65)' }
          ]} 
        />
      )}
      {renderIcon()}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        onPressIn={() => !disabled && setPressed(true)}
        onPressOut={() => setPressed(false)}
        onHoverIn={() => !disabled && setHovered(true)}
        onHoverOut={() => setHovered(false)}
        disabled={disabled}
        style={containerStyles}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: isSelected, disabled }}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View 
      style={containerStyles}
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      web: {
        transition: 'transform 0.05s ease, border-bottom-width 0.05s ease, background-color 0.1s ease',
      },
    }),
  },
  contentWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    zIndex: 1,
  },
  unselected: {
    backgroundColor: '#FAFAFA',
    borderColor: '#E4E4E7',
    borderBottomColor: '#A1A1AA',
  },
  selected: {
    backgroundColor: '#171717',
    borderColor: '#2E2E2E',
    borderBottomColor: '#050505',
  },
  pressed: {
    transform: [{ translateY: 2 }, { scale: 0.97 }],
  },
  disabled: {
    backgroundColor: '#F4F4F5',
    borderColor: '#E4E4E7',
    borderBottomWidth: 1,
    borderBottomColor: '#D4D4D8',
    opacity: 0.4,
  },
});

export default DimensionalIcon;
