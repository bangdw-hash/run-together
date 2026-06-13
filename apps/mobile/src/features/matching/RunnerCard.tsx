import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NearbyRunner } from '@run-together/shared';
import { formatDistance, formatPace, type Units } from '../../lib/format';
import { colors, radii } from '../../theme';

interface Props {
  runner: NearbyRunner;
  units: Units;
  requested: boolean;
  disabled: boolean;
  onJoin(runner: NearbyRunner): void;
}

export function RunnerCard({ runner, units, requested, disabled, onJoin }: Props) {
  const { t } = useTranslation();
  const minutes = Math.max(1, Math.round((Date.now() - runner.startedAtMs) / 60_000));
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.nickname}>{runner.nickname}</Text>
        <Text style={styles.meta}>
          {formatPace(runner.paceSecPerKm, units)} · {t('run.runningFor', { minutes })}
        </Text>
        <Text style={styles.distance}>
          {t('run.distanceAway', { distance: formatDistance(runner.distanceM, units) })}
        </Text>
      </View>
      <Pressable
        style={[styles.joinBtn, (requested || disabled) && styles.joinBtnDim]}
        disabled={requested || disabled}
        onPress={() => onJoin(runner)}
      >
        <Text style={styles.joinText}>{requested ? t('run.requestSent') : t('run.join')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  info: { flex: 1 },
  nickname: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  distance: { color: colors.accent, fontSize: 13, marginTop: 2, fontWeight: '600' },
  joinBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  joinBtnDim: { opacity: 0.4 },
  joinText: { color: colors.accentDark, fontWeight: '800', fontSize: 14 },
});
