import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radii } from '../../theme';

interface Props {
  onRate(score: number): void;
  onReport(): void;
}

/** Post-run mutual 5-star rating + report (work order §3.3). */
export function RatingRow({ onRate, onReport }: Props) {
  const { t } = useTranslation();
  const [score, setScore] = useState(0);
  const [reported, setReported] = useState(false);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('summary.rateTitle')}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Pressable
            key={s}
            hitSlop={6}
            onPress={() => {
              setScore(s);
              onRate(s);
            }}
          >
            <Text style={[styles.star, s <= score && styles.starOn]}>★</Text>
          </Pressable>
        ))}
      </View>
      {reported ? (
        <Text style={styles.reportedText}>{t('summary.reported')}</Text>
      ) : (
        <Pressable
          style={styles.reportBtn}
          onPress={() => {
            setReported(true);
            onReport();
          }}
        >
          <Text style={styles.reportText}>{t('summary.report')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', marginTop: 14 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  stars: { flexDirection: 'row', gap: 6, marginTop: 8 },
  star: { fontSize: 32, color: colors.border },
  starOn: { color: colors.gold },
  reportBtn: { marginTop: 8, minHeight: 40, justifyContent: 'center', borderRadius: radii.full },
  reportText: { color: colors.warn, fontSize: 13 },
  reportedText: { color: colors.textDim, fontSize: 12, marginTop: 8, textAlign: 'center' },
});
