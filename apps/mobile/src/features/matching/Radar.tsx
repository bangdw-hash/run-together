import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

export interface RadarBlip {
  id: string;
  bearingDeg: number;
  distanceM: number;
  isPartner?: boolean;
}

interface Props {
  blips: RadarBlip[];
  rendezvous?: { bearingDeg: number; distanceM: number } | null;
  size?: number;
  maxRangeM?: number;
}

/**
 * Map-free "radar": the user sits at the center, nearby runners are plotted
 * by bearing/distance. Production replaces this with a real map adapter
 * (Mapbox / Kakao) — see docs/ARCHITECTURE.md §3.
 */
export function Radar({ blips, rendezvous, size = 260, maxRangeM = 3000 }: Props) {
  const half = size / 2;
  const place = (bearingDeg: number, distanceM: number) => {
    const r = (Math.min(distanceM, maxRangeM) / maxRangeM) * (half - 14);
    const rad = ((bearingDeg - 90) * Math.PI) / 180; // 0° = up (north)
    return { left: half + r * Math.cos(rad) - 7, top: half + r * Math.sin(rad) - 7 };
  };

  return (
    <View style={[styles.radar, { width: size, height: size, borderRadius: half }]}>
      {[0.33, 0.66, 1].map((f) => (
        <View
          key={f}
          style={[
            styles.ring,
            {
              width: size * f,
              height: size * f,
              borderRadius: (size * f) / 2,
              left: half - (size * f) / 2,
              top: half - (size * f) / 2,
            },
          ]}
        />
      ))}
      {blips.map((b) => (
        <View
          key={b.id}
          style={[
            styles.blip,
            b.isPartner && styles.partnerBlip,
            place(b.bearingDeg, b.distanceM),
          ]}
        />
      ))}
      {rendezvous && (
        <Text style={[styles.flag, place(rendezvous.bearingDeg, rendezvous.distanceM)]}>🚩</Text>
      )}
      <View style={[styles.me, { left: half - 8, top: half - 8 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  radar: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.6,
  },
  me: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.bg,
  },
  blip: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.textDim,
  },
  partnerBlip: {
    backgroundColor: colors.gold,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  flag: {
    position: 'absolute',
    fontSize: 16,
    marginLeft: -2,
    marginTop: -6,
  },
});
