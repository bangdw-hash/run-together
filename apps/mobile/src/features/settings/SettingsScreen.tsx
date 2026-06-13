import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../state/settings';
import { colors, radii } from '../../theme';

interface Props {
  onDone(): void;
}

export function SettingsScreen({ onDone }: Props) {
  const { t } = useTranslation();
  const settings = useSettings();

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress(): void }) => (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <Text style={styles.label}>{t('settings.language')}</Text>
      <View style={styles.row}>
        <Chip
          on={settings.locale === 'ko'}
          label={t('settings.korean')}
          onPress={() => settings.setSettings({ locale: 'ko' })}
        />
        <Chip
          on={settings.locale === 'en'}
          label={t('settings.english')}
          onPress={() => settings.setSettings({ locale: 'en' })}
        />
      </View>

      <Text style={styles.label}>{t('settings.units')}</Text>
      <View style={styles.row}>
        <Chip
          on={settings.units === 'km'}
          label={t('settings.km')}
          onPress={() => settings.setSettings({ units: 'km' })}
        />
        <Chip
          on={settings.units === 'mi'}
          label={t('settings.mi')}
          onPress={() => settings.setSettings({ units: 'mi' })}
        />
      </View>

      <Text style={styles.label}>{t('settings.visibility')}</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('settings.visibilityOn')}</Text>
        <Switch
          value={settings.visibility === 'all'}
          onValueChange={(on) => settings.setSettings({ visibility: on ? 'all' : 'off' })}
          trackColor={{ true: colors.accent, false: colors.border }}
        />
      </View>
      <Text style={styles.hint}>{t('settings.visibilityHint')}</Text>

      <Text style={styles.label}>{t('settings.serverUrl')}</Text>
      <TextInput
        style={styles.input}
        value={settings.serverUrl}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="http://192.168.0.10:4000"
        placeholderTextColor={colors.textDim}
        onChangeText={(serverUrl) => settings.setSettings({ serverUrl })}
      />
      <Text style={styles.hint}>{t('settings.serverHint')}</Text>

      <Pressable style={styles.doneBtn} onPress={onDone}>
        <Text style={styles.doneText}>{t('settings.done')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 70 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: 24 },
  label: {
    color: colors.textDim,
    fontSize: 13,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: 18,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textDim, fontWeight: '600', fontSize: 15 },
  chipTextOn: { color: colors.accentDark },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    minHeight: 54,
  },
  switchLabel: { color: colors.text, fontSize: 15, flex: 1, marginRight: 10 },
  hint: { color: colors.textDim, fontSize: 12, marginTop: 8, lineHeight: 18 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  doneBtn: {
    backgroundColor: colors.accent,
    minHeight: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
  },
  doneText: { color: colors.accentDark, fontWeight: '800', fontSize: 16 },
});
