import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from '../components/AppHeader';
import { colors, layout, spacing, typography } from '../constants';

const sections = [
  ['Using YSnap', 'Use YSnap lawfully and only with content, recordings, and voices you own or have permission to process. Translation may contain errors, so verify important medical, legal, safety, or financial information.'],
  ['Your content', 'You keep ownership of your text, images, and recordings. You grant YSnap only the limited rights needed to process your request and provide the service.'],
  ['Voice and privacy', 'Do not clone or imitate another person without clear authorization. You can review and delete retained account data from Privacy and data settings.'],
  ['Accounts', 'Keep your credentials secure. You may stop using YSnap and request account deletion at any time.'],
];

export default function TermsScreen() {
  return <SafeAreaView style={styles.safeArea}><StatusBar style="dark" /><View style={styles.shell}>
    <AppHeader title="Terms of Use" showBack />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.updated}>Effective July 13, 2026</Text>
      <Text style={styles.intro}>These terms explain the basic rules for using YSnap. Store-listing terms and regional disclosures should be reviewed by counsel before public release.</Text>
      {sections.map(([title, body]) => <View key={title} style={styles.section}><Text style={styles.title}>{title}</Text><Text style={styles.body}>{body}</Text></View>)}
    </ScrollView>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, shell: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.pageMargin },
  content: { paddingBottom: spacing['2xl'] }, updated: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md },
  intro: { ...typography.bodyLarge, color: colors.textPrimary, marginVertical: spacing.xl }, section: { backgroundColor: colors.backgroundSoft, borderRadius: 18, padding: spacing.lg, marginBottom: spacing.sm },
  title: { ...typography.heading3, color: colors.textPrimary, marginBottom: spacing.xs }, body: { ...typography.body, color: colors.textSecondary },
});
