import type { TFunction } from 'i18next';

export type Units = 'km' | 'mi';

const MI_IN_KM = 1.609_344;

/** 372 s/km → "6'12"/km" (or converted to /mi). */
export function formatPace(secPerKm: number, units: Units): string {
  const sec = units === 'mi' ? secPerKm * MI_IN_KM : secPerKm;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}'${String(s).padStart(2, '0')}"/${units}`;
}

/** Meters → "850m" / "1.2km" (or yd/mi). */
export function formatDistance(meters: number, units: Units): string {
  if (units === 'mi') {
    const mi = meters / (MI_IN_KM * 1000);
    return mi < 0.1 ? `${Math.round(meters * 1.0936)}yd` : `${mi.toFixed(1)}mi`;
  }
  return meters < 950 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

/** Seconds → "12:05" or "1:02:33". */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Bearing in degrees → localized compass direction ("north", "북쪽"…). */
export function formatBearing(deg: number, t: TFunction): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return t(`bearing.${dirs[idx]}`);
}
