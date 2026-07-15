import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface VoiceCardProps {
  id: string;
  name: string;
  accentInfo?: string;
  isCloned?: boolean;
  selected: boolean;
  isPlayingPreview?: boolean;
  onSelect: () => void;
  onPlayPreview: () => void;
  style?: ViewStyle;
}

export const VoiceCard: React.FC<VoiceCardProps> = ({
  id,
  name,
  accentInfo,
  isCloned = false,
  selected,
  isPlayingPreview = false,
  onSelect,
  onPlayPreview,
  style,
}) => {
  const handleSelect = () => {
    triggerHaptic('selection');
    onSelect();
  };

  const handlePlayPreview = (e: any) => {
    e.stopPropagation(); // Avoid triggering card selection
    triggerHaptic('light');
    onPlayPreview();
  };

  return (
    <Pressable
      onPress={handleSelect}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.selectedCard : styles.unselectedCard,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Voice: ${name}. ${accentInfo || ''}`}
    >
      <View style={styles.content}>
        {/* Play Preview Icon */}
        <Pressable
          onPress={handlePlayPreview}
          style={styles.previewBtn}
          accessibilityLabel={isPlayingPreview ? 'Stop playing preview' : 'Play voice preview sample'}
        >
          <Ionicons
            name={isPlayingPreview ? 'square' : 'play-circle'}
            size={36}
            color={selected ? colors.accentPurple : colors.textPrimary}
          />
        </Pressable>

        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{name}</Text>
            {isCloned && (
              <View style={styles.cloneBadge}>
                <Text style={styles.cloneBadgeText}>Cloned</Text>
              </View>
            )}
          </View>
          {accentInfo && <Text style={styles.accentText}>{accentInfo}</Text>}
        </View>

        {/* Selection Radio Circle */}
        <View
          style={[
            styles.radioCircle,
            selected ? styles.radioSelected : styles.radioUnselected,
          ]}
        >
          {selected && <View style={styles.radioInner} />}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: layout.cardRadius,
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    width: '100%',
  },
  selectedCard: {
    borderColor: colors.accentPurple,
    backgroundColor: colors.surfaceSoft,
  },
  unselectedCard: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.bodySemibold,
    color: colors.textPrimary,
  },
  cloneBadge: {
    backgroundColor: colors.surfaceSuccess,
    borderWidth: 1,
    borderColor: colors.accentGreen + '30',
    borderRadius: 6,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  cloneBadgeText: {
    ...typography.smallMedium,
    fontSize: 9,
    color: colors.success,
  },
  accentText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: colors.accentPurple,
  },
  radioUnselected: {
    borderColor: colors.borderStrong,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accentPurple,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
export default VoiceCard;
