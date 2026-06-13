import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { upsertProfile, type AgeGroup, type Gender } from '../../lib/api';
import { formatPace } from '../../lib/format';
import { useSettings } from '../../state/settings';
import { colors, radii } from '../../theme';

interface Props {
  onDone(): void;
}

const AGE_GROUPS: AgeGroup[] = ['10s', '20s', '30s', '40s', '50s', '60s+'];
const PACES = [270, 300, 330, 360, 420, 480];

/** Mandatory profile (work order §3.1): nickname, gender, age group, pace. */
export function ProfileSetupScreen({ onDone }: Props) {
  const { t } = useTranslation();
  const settings = useSettings();
  const [nickname, setNickname] = useState(settings.nickname);
  const [gender, setGender] = useState<Gender | null>(null);
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [pace, setPace] = useState(settings.paceSecPerKm);
  const [femaleOnly, setFemaleOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = nickname.trim().length >= 2 && gender !== null && ageGroup !== null;

  const save = async () => {
    if (!valid || gender === null || ageGroup === null) return;
    setBusy(true);
    setError(null);
    const res = await upsertProfile({
      nickname: nickname.trim(),
      gender,
      ageGroup,
      avgPaceSec: pace,
      locale: settings.locale,
      femaleOnly: gender === 'female' && femaleOnly,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    settings.setSettings({ nickname: nickname.trim(), paceSecPerKm: pace });
    onDone();
  };

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress(): void }) => (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('auth.profileTitle')}</Text>

      <Text style={styles.label}>{t('home.nickname')}</Text>
      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
        maxLength={20}
        placeholder="Runner"
        placeholderTextColor={colors.textDim}
      />

      <Text style={styles.label}>{t('auth.gender')}</Text>
      <View style={styles.row}>
        {(['female', 'male', 'other'] as const).map((g) => (
          <Chip key={g} on={gender === g} label={t(`auth.${g}`)} onPress={() => setGender(g)} />
        ))}
      </View>

      {gender === 'female' && (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('auth.femaleOnly')}</Text>
          <Switch
            value={femaleOnly}
            onValueChange={setFemaleOnly}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
      )}

      <Text style={styles.label}>{t('auth.ageGroup')}</Text>
      <View style={styles.row}>
        {AGE_GROUPS.map((a) => (
          <Chip key={a} on={ageGroup === a} label={a} onPress={() => setAgeGroup(a)} />
        ))}
      </View>

      <Text style={styles.label}>{t('home.pace')}</Text>
      <View style={styles.row}>
        {PACES.map((p) => (
          <Chip
            key={p}
            on={pace === p}
            label={formatPace(p, settings.units)}
            onPress={() => setPace(p)}
          />
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={[styles.saveBtn, (!valid || busy) && styles.saveBtnDim]}
        disabled={!valid || busy}
        onPress={save}
      >
        <Text style={styles.saveText}>{t('auth.save')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 70, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', marginBottom: 10 },
  label: {
    color: colors.textDim,
    fontSize: 13,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textDim, fontWeight: '600' },
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
    marginTop: 12,
  },
  switchLabel: { color: colors.text, fontSize: 15, flex: 1, marginRight: 10 },
  error: { color: colors.warn, marginTop: 16 },
  saveBtn: {
    backgroundColor: colors.accent,
    minHeight: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  saveBtnDim: { opacity: 0.4 },
  saveText: { color: colors.accentDark, fontWeight: '800', fontSize: 16 },
});
