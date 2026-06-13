import React from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { LatLng } from '@run-together/shared';
import { triggerEmergency } from '../../lib/api';
import { colors, radii } from '../../theme';

interface Props {
  getLocation(): LatLng | null;
}

/**
 * 긴급 위치 공유 (work order §3.3): one tap → confirm → SMS with a live
 * location link goes to the registered emergency contacts via the
 * emergency-alert edge function (simulated when Supabase isn't configured).
 */
export function EmergencyButton({ getLocation }: Props) {
  const { t } = useTranslation();

  const onPress = () => {
    const loc = getLocation();
    if (!loc) return;
    Alert.alert(t('emergency.confirmTitle'), t('emergency.confirmBody'), [
      { text: t('emergency.cancel'), style: 'cancel' },
      {
        text: t('emergency.send'),
        style: 'destructive',
        onPress: async () => {
          const result = await triggerEmergency(loc);
          Alert.alert(
            t('emergency.confirmTitle'),
            result.simulated ? `${t('emergency.sent')}\n${t('emergency.demo')}` : t('emergency.sent'),
          );
        },
      },
    ]);
  };

  return (
    <Pressable style={styles.btn} onPress={onPress} hitSlop={8}>
      <Text style={styles.text}>🆘 {t('emergency.button')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.warn,
    borderRadius: radii.full,
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
