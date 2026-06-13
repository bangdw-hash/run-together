import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { JoinIncoming } from '@run-together/shared';
import { formatDistance, formatPace, type Units } from '../../lib/format';
import { colors, radii } from '../../theme';

interface Props {
  request: JoinIncoming | null;
  units: Units;
  onRespond(requestId: string, accept: boolean): void;
}

export function JoinRequestModal({ request, units, onRespond }: Props) {
  const { t } = useTranslation();
  if (!request) return null;
  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('run.incomingTitle')}</Text>
          <Text style={styles.body}>
            {t('run.incomingBody', {
              nickname: request.nickname,
              pace: formatPace(request.paceSecPerKm, units),
              distance: formatDistance(request.distanceM, units),
            })}
          </Text>
          {request.message ? <Text style={styles.message}>“{request.message}”</Text> : null}
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.decline]} onPress={() => onRespond(request.requestId, false)}>
              <Text style={styles.declineText}>{t('run.decline')}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.accept]} onPress={() => onRespond(request.requestId, true)}>
              <Text style={styles.acceptText}>{t('run.accept')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cardAlt,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: 24,
    paddingBottom: 36,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { color: colors.textDim, fontSize: 15, marginTop: 8 },
  message: { color: colors.accent, fontSize: 15, marginTop: 10, fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  declineText: { color: colors.textDim, fontWeight: '700', fontSize: 16 },
  accept: { backgroundColor: colors.accent },
  acceptText: { color: colors.accentDark, fontWeight: '800', fontSize: 16 },
});
