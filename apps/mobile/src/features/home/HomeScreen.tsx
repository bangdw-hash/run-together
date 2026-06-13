import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatPace } from '../../lib/format';
import { useSettings } from '../../state/settings';
import { colors, radii } from '../../theme';

interface Props {
  onRun(): void;
  onSettings(): void;
}

export function HomeScreen({ onRun, onSettings }: Props) {
  const { t } = useTranslation();
  const settings = useSettings();

  return (
    <View style={styles.screen}>
      <Text style={styles.logo}>🏃 {t('app.name')}</Text>
      <Text style={styles.tagline}>{t('home.tagline')}</Text>

      <View style={styles.form}>
        <Text style={styles.label}>{t('home.nickname')}</Text>
        <TextInput
          style={styles.input}
          value={settings.nickname}
          placeholder="Runner"
          placeholderTextColor={colors.textDim}
          maxLength={20}
          onChangeText={(nickname) => settings.setSettings({ nickname })}
        />
        <Text style={styles.label}>{t('home.pace')}</Text>
        <View style={styles.paceRow}>
          {[300, 330, 360, 420, 480].map((pace) => (
            <Pressable
              key={pace}
              style={[styles.paceChip, settings.paceSecPerKm === pace && styles.paceChipOn]}
              onPress={() => settings.setSettings({ paceSecPerKm: pace })}
            >
              <Text
                style={[
                  styles.paceChipText,
                  settings.paceSecPerKm === pace && styles.paceChipTextOn,
                ]}
              >
                {formatPace(pace, settings.units)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={styles.runBtn} onPress={onRun}>
        <Text style={styles.runText}>{t('home.runNow')}</Text>
      </Pressable>
      {!settings.serverUrl && <Text style={styles.demoNote}>{t('home.demoNote')}</Text>}

      <Pressable style={styles.settingsBtn} onPress={onSettings}>
        <Text style={styles.settingsText}>⚙ {t('home.settings')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 90 },
  logo: { color: colors.text, fontSize: 34, fontWeight: '900' },
  tagline: { color: colors.textDim, fontSize: 16, lineHeight: 24, marginTop: 12 },
  form: { marginTop: 36 },
  label: { color: colors.textDim, fontSize: 13, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    minHeight: 50,
    marginBottom: 18,
  },
  paceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  paceChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  paceChipText: { color: colors.textDim, fontWeight: '600' },
  paceChipTextOn: { color: colors.accentDark },
  runBtn: {
    backgroundColor: colors.accent,
    minHeight: 64,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  runText: { color: colors.accentDark, fontSize: 20, fontWeight: '900' },
  demoNote: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 10 },
  settingsBtn: { alignItems: 'center', marginTop: 16, minHeight: 44, justifyContent: 'center' },
  settingsText: { color: colors.textDim, fontSize: 15 },
});
