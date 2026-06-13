import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radii } from '../../theme';

interface Props {
  visible: boolean;
  onConfirm(): void;
}

/** Mandatory first-match safety briefing (work order §3.3). */
export function SafetyNoticeModal({ visible, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>🛡 {t('safety.title')}</Text>
          {(['rule1', 'rule2', 'rule3'] as const).map((k) => (
            <Text key={k} style={styles.rule}>
              • {t(`safety.${k}`)}
            </Text>
          ))}
          <Pressable style={styles.btn} onPress={onConfirm}>
            <Text style={styles.btnText}>{t('safety.confirm')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  sheet: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 14 },
  rule: { color: colors.textDim, fontSize: 15, lineHeight: 22, marginBottom: 10 },
  btn: {
    backgroundColor: colors.accent,
    minHeight: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  btnText: { color: colors.accentDark, fontWeight: '800', fontSize: 16 },
});
