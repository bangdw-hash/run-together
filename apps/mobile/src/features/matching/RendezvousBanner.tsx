import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatBearing, formatDistance, type Units } from '../../lib/format';
import { colors, radii } from '../../theme';

interface Props {
  bearingDeg: number;
  distanceM: number;
  myEtaSec: number;
  partnerEtaSec: number;
  partnerNickname: string;
  met: boolean;
  units: Units;
}

export function RendezvousBanner(props: Props) {
  const { t } = useTranslation();
  if (props.met) {
    return (
      <View style={[styles.banner, styles.metBanner]}>
        <Text style={styles.metText}>{t('run.met')}</Text>
      </View>
    );
  }
  const minutes = Math.max(1, Math.round(props.myEtaSec / 60));
  const partnerMinutes = Math.max(1, Math.round(props.partnerEtaSec / 60));
  return (
    <View style={styles.banner}>
      <Text style={styles.arrow}>{'↑'}</Text>
      <View style={styles.textCol}>
        <Text style={styles.title}>{t('run.rendezvousTitle')}</Text>
        <Text style={styles.body}>
          {t('run.rendezvousBody', {
            bearing: formatBearing(props.bearingDeg, t),
            distance: formatDistance(props.distanceM, props.units),
            minutes,
          })}
        </Text>
        <Text style={styles.partner}>
          {t('run.partnerEta', { nickname: props.partnerNickname, minutes: partnerMinutes })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  metBanner: { backgroundColor: colors.accent, justifyContent: 'center' },
  metText: { color: colors.accentDark, fontSize: 17, fontWeight: '800' },
  arrow: { color: colors.accent, fontSize: 30, fontWeight: '900' },
  textCol: { flex: 1 },
  title: { color: colors.text, fontWeight: '800', fontSize: 15 },
  body: { color: colors.accent, marginTop: 2, fontSize: 14, fontWeight: '600' },
  partner: { color: colors.textDim, marginTop: 2, fontSize: 13 },
});
