import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { triggerHaptic } from '../../lib/haptics';

interface TactileButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
}) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handlePress = () => {
    if (loading || disabled) return;
    triggerHaptic('medium');
    onPress();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'destructive':
        return {
          face: styles.destructiveFace,
          hovered: styles.destructiveHovered,
          pressed: styles.destructivePressed,
          disabled: styles.destructiveDisabled,
          text: styles.destructiveText,
        };
      case 'secondary':
        return {
          face: styles.secondaryFace,
          hovered: styles.secondaryHovered,
          pressed: styles.secondaryPressed,
          disabled: styles.secondaryDisabled,
          text: styles.secondaryText,
        };
      case 'text':
        return {
          face: styles.textFace,
          hovered: styles.textHovered,
          pressed: styles.textPressed,
          disabled: styles.textDisabled,
          text: styles.textText,
        };
      case 'primary':
      default:
        return {
          face: styles.primaryFace,
          hovered: styles.primaryHovered,
          pressed: styles.primaryPressed,
          disabled: styles.primaryDisabled,
          text: styles.primaryText,
        };
    }
  };

  const vStyles = getVariantStyles();

  const buttonStyles = [
    styles.buttonBase,
    vStyles.face,
    disabled && vStyles.disabled,
    !disabled && hovered && vStyles.hovered,
    !disabled && pressed && vStyles.pressed,
    isFocused && styles.focusedOutline,
    style,
  ];

  const labelStyles = [
    styles.labelBase,
    vStyles.text,
    disabled && styles.labelDisabled,
    textStyle,
  ];

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => !disabled && !loading && setPressed(true)}
        onPressOut={() => setPressed(false)}
        onHoverIn={() => !disabled && !loading && setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled || loading}
        style={buttonStyles}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        {loading ? (
          <View style={styles.contentContainer}>
            <ActivityIndicator 
              color={variant === 'secondary' || variant === 'text' ? colors.textPrimary : '#FFFFFF'} 
              style={{ marginRight: 8 }} 
            />
            <Text style={labelStyles}>Loading...</Text>
          </View>
        ) : (
          <View style={styles.contentContainer}>
            {icon && iconPosition === 'left' && <View style={styles.leftIcon}>{icon}</View>}
            <Text style={labelStyles}>{title}</Text>
            {icon && iconPosition === 'right' && <View style={styles.rightIcon}>{icon}</View>}
          </View>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    alignSelf: 'center',
  },
  buttonBase: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    // Mobile dimensions
    height: 56,
    borderRadius: 16,
    ...Platform.select({
      web: {
        // Desktop dimensions
        height: 48,
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'transform 0.08s ease, border-bottom-width 0.08s ease, background-color 0.12s ease',
      },
    }),
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBase: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: typography.button.fontFamily,
    ...Platform.select({
      web: {
        fontSize: 15,
      },
    }),
  },
  labelDisabled: {
    opacity: 0.5,
  },
  leftIcon: {
    marginRight: spacing.xs,
  },
  rightIcon: {
    marginLeft: spacing.xs,
  },

  // Primary Variant (TokenSupply-inspired near-black 3D)
  primaryFace: {
    backgroundColor: '#161618',
    borderColor: '#333336', // Upper border sheen highlight
    borderBottomWidth: 3.5,
    borderBottomColor: '#09090A', // Deep lower surface shadow
  },
  primaryHovered: {
    backgroundColor: '#1E1E22',
    borderColor: '#444448', // Brighten top edge
    transform: [{ translateY: 1 }],
    borderBottomWidth: 2.5,
  },
  primaryPressed: {
    backgroundColor: '#111112',
    borderColor: '#222224',
    transform: [{ translateY: 2.5 }, { scale: 0.985 }],
    borderBottomWidth: 1,
  },
  primaryDisabled: {
    backgroundColor: '#E4E4E7',
    borderColor: '#D4D4D8',
    borderBottomWidth: 1,
    borderBottomColor: '#A1A1AA',
  },
  primaryText: {
    color: '#FFFFFF',
  },

  // Secondary Variant (Restrained monochrome border 3D)
  secondaryFace: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    borderBottomWidth: 3,
    borderBottomColor: '#C4C4C7',
  },
  secondaryHovered: {
    backgroundColor: '#FAFAFA',
    borderColor: '#D4D4D8',
    transform: [{ translateY: 1 }],
    borderBottomWidth: 2,
  },
  secondaryPressed: {
    backgroundColor: '#F4F4F5',
    borderColor: '#D4D4D8',
    transform: [{ translateY: 2 }, { scale: 0.985 }],
    borderBottomWidth: 1,
  },
  secondaryDisabled: {
    backgroundColor: '#F4F4F5',
    borderColor: '#E4E4E7',
    borderBottomWidth: 1,
    borderBottomColor: '#D4D4D8',
  },
  secondaryText: {
    color: colors.textPrimary,
  },

  // Destructive Variant (Tactile Red)
  destructiveFace: {
    backgroundColor: '#C62828',
    borderColor: '#E57373',
    borderBottomWidth: 3,
    borderBottomColor: '#5D0E11',
  },
  destructiveHovered: {
    backgroundColor: '#D32F2F',
    borderColor: '#EF9A9A',
    transform: [{ translateY: 1 }],
    borderBottomWidth: 2,
  },
  destructivePressed: {
    backgroundColor: '#B71C1C',
    borderColor: '#E57373',
    transform: [{ translateY: 2 }, { scale: 0.985 }],
    borderBottomWidth: 1,
  },
  destructiveDisabled: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
    borderBottomWidth: 1,
    borderBottomColor: '#EF9A9A',
  },
  destructiveText: {
    color: '#FFFFFF',
  },

  // Text Variant (Flat Link)
  textFace: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderBottomWidth: 0,
    borderWidth: 0,
    height: 44,
  },
  textHovered: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  textPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  textDisabled: {
    opacity: 0.5,
  },
  textText: {
    color: colors.textSubtle,
  },
  
  // Accessible focus outline for web navigation
  focusedOutline: Platform.select({
    web: {
      outlineWidth: 2,
      outlineStyle: 'solid',
      outlineColor: '#000000',
      outlineOffset: 2,
    } as any,
    default: {},
  }),
});

export default TactileButton;
