import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { getLanguageByCode } from '../constants/languages';
import { Ionicons } from '@expo/vector-icons';

export default function BookmarksScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch Bookmarks
  const { data: bookmarks, isLoading } = useQuery<any[]>({
    queryKey: ['bookmarks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  // 2. Delete Bookmark Mutation
  const deleteBookmarkMutation = useMutation<any, any, string>({
    mutationFn: async (bookmarkId: string) => {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', bookmarkId);
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['homeBookmarks', user?.id] });
    },
  });

  const handleRemoveBookmark = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Remove Pinned Phrase', 'Are you sure you want to remove this from your pinned list?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Remove', 
        style: 'destructive',
        onPress: () => deleteBookmarkMutation.mutate(id)
      }
    ]);
  };

  const handlePlayAudio = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TTS Audio player shortcut
  };

  // Filter Bookmarks
  const filteredBookmarks = (bookmarks ?? []).filter((item) => 
    item.source_text.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.translated_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Pinned Book</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textSubtle} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search pinned phrases..."
          placeholderTextColor={colors.textSubtle}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Bookmarks List */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredBookmarks.length > 0 ? (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {filteredBookmarks.map((item) => (
            <View key={item.id} style={styles.bookmarkCard}>
              
              <View style={styles.cardHeader}>
                <View style={styles.langPair}>
                  <Text style={styles.langTag}>{getLanguageByCode(item.source_language ?? 'en')?.name}</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.textMuted} style={{ marginHorizontal: 6 }} />
                  <Text style={styles.langTag}>{getLanguageByCode(item.target_language ?? 'es')?.name}</Text>
                </View>
                
                <View style={styles.actions}>
                  <Pressable style={styles.actionBtn} onPress={handlePlayAudio}>
                    <Ionicons name="volume-medium-outline" size={18} color={colors.primary} />
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => handleRemoveBookmark(item.id)}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.sourceText}>{item.source_text}</Text>
              <Text style={styles.translatedText}>{item.translated_text}</Text>
              
              {item.note && (
                <View style={styles.noteBox}>
                  <Text style={styles.noteText}>{item.note}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={48} color={colors.borderStrong} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No pinned phrases</Text>
          <Text style={styles.emptyDesc}>Pin translation results to save important phrases here.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: typography.heading3.fontFamily,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
    color: colors.textPrimary,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  bookmarkCard: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  langPair: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langTag: {
    fontSize: 11,
    fontFamily: typography.captionMedium.fontFamily,
    fontWeight: '700',
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 15,
    fontFamily: typography.bodyMedium.fontFamily,
    fontWeight: typography.bodyMedium.fontWeight,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  translatedText: {
    fontSize: 16,
    fontFamily: typography.bodySemibold.fontFamily,
    color: colors.accentPurple,
    marginBottom: 10,
  },
  noteBox: {
    backgroundColor: colors.surfaceWarning,
    borderWidth: 1,
    borderColor: '#F9E5C9',
    borderRadius: 10,
    padding: 10,
  },
  noteText: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: typography.heading4.fontFamily,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: typography.body.fontFamily,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
