import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useCameraState } from './cameraState';
import { languages } from '../../constants/languages';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

interface CameraLanguageSheetProps {
  visible: boolean;
  onClose: () => void;
  onLanguageSelected?: (code: string) => void;
}

export const CameraLanguageSheet: React.FC<CameraLanguageSheetProps> = ({
  visible,
  onClose,
  onLanguageSelected,
}) => {
  const { targetLanguage, setTargetLanguage } = useCameraState();
  const [search, setSearch] = useState('');

  const filtered = languages.filter((l) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  const handleSelect = (code: string) => {
    setTargetLanguage(code);
    if (onLanguageSelected) {
      onLanguageSelected(code);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Target Translation Language</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textSubtle} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search languages..."
              placeholderTextColor={colors.textSubtle}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {filtered.map((lang) => {
              const isSelected = targetLanguage === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  style={[styles.langItem, isSelected && styles.langItemActive]}
                  onPress={() => handleSelect(lang.code)}
                >
                  <View style={styles.langItemLabelRow}>
                    <Text style={[styles.langName, isSelected && styles.langTextActive]}>
                      {lang.name}
                    </Text>
                    <Text style={[styles.nativeName, isSelected && styles.langTextActive]}>
                      {lang.nativeName}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={colors.accentPurple || '#7C6CD0'} />
                  )}
                </Pressable>
              );
            })}
            {filtered.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No languages match your search.</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E7E6EB',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary || '#0B0A0B',
  },
  closeBtn: {
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: colors.backgroundSoft || '#F8F8FC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border || '#E7E6EB',
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary || '#0B0A0B',
    fontSize: 15,
    paddingVertical: 0,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  langItemActive: {
    backgroundColor: colors.overlayLight || 'rgba(9, 9, 9, 0.08)',
  },
  langItemLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  langName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary || '#0B0A0B',
    marginRight: 8,
  },
  nativeName: {
    fontSize: 13,
    color: colors.textSecondary || '#67676C',
  },
  langTextActive: {
    color: colors.accentPurple || '#7C6CD0',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSubtle || '#9B9BA1',
    fontSize: 14,
  },
});
