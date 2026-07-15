import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { VoiceCard } from './VoiceCard';
import { SearchInput } from './SearchInput';
import { colors, layout, spacing, typography } from '@/constants';
import { triggerHaptic } from '@/lib/haptics';

interface VoiceItem {
  id: string;
  name: string;
  accentInfo: string;
  isCloned?: boolean;
}

interface VoiceSelectorSheetProps {
  visible: boolean;
  onClose: () => void;
  voices: VoiceItem[];
  selectedVoiceId: string | null;
  onSelectVoice: (id: string) => void;
  isPlayingPreviewId: string | null;
  onPlayPreview: (id: string) => void;
}

export const VoiceSelectorSheet: React.FC<VoiceSelectorSheetProps> = ({
  visible,
  onClose,
  voices,
  selectedVoiceId,
  onSelectVoice,
  isPlayingPreviewId,
  onPlayPreview,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  const filteredVoices = voices.filter((voice) =>
    voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    voice.accentInfo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <View style={styles.sheet}>
          <SafeAreaView style={styles.safeContainer}>
            {/* Sheet Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Select Voice</Text>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                accessibilityLabel="Close voice selector sheet"
              >
                <Feather name="x" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={styles.searchWrapper}>
              <SearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search voices..."
                onClear={() => setSearchQuery('')}
              />
            </View>

            {/* Scrollable List */}
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {filteredVoices.length > 0 ? (
                filteredVoices.map((voice) => (
                  <VoiceCard
                    key={voice.id}
                    id={voice.id}
                    name={voice.name}
                    accentInfo={voice.accentInfo}
                    isCloned={voice.isCloned}
                    selected={voice.id === selectedVoiceId}
                    isPlayingPreview={voice.id === isPlayingPreviewId}
                    onSelect={() => onSelectVoice(voice.id)}
                    onPlayPreview={() => onPlayPreview(voice.id)}
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Feather name="mic-off" size={32} color={colors.textSubtle} />
                  <Text style={styles.emptyText}>No voices found matching search</Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '60%',
    shadowColor: '#090909',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  safeContainer: {
    flex: 1,
    paddingBottom: Platform.OS === 'ios' ? 0 : spacing.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: layout.sheetHandleWidth,
    height: layout.sheetHandleHeight,
    borderRadius: layout.sheetHandleHeight / 2,
    backgroundColor: colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.pageMargin,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heading2,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchWrapper: {
    paddingHorizontal: layout.pageMargin,
    marginBottom: spacing.md,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.pageMargin,
    paddingBottom: spacing['2xl'],
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
export default VoiceSelectorSheet;
