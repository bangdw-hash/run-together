import { describe, expect, it } from 'vitest';
import { RunTracker, maskPii, projectPoint } from '@run-together/shared';

const START = { lat: 37.5283, lng: 126.9294 };

describe('RunTracker', () => {
  it('accumulates distance and derives pace on a steady run', () => {
    const tracker = new RunTracker();
    const t0 = Date.now();
    // 3 m/s due east, ping every 3 s for 5 minutes → 900 m.
    let stats = tracker.add({ ...START, ts: t0 });
    for (let i = 1; i <= 100; i++) {
      stats = tracker.add({ ...projectPoint(START, 90, 9 * i), ts: t0 + i * 3000 });
    }
    expect(stats.distanceM).toBeCloseTo(900, -1);
    expect(stats.elapsedSec).toBe(300);
    // 3 m/s ≈ 5:33/km ≈ 333 s/km
    expect(stats.avgPaceSecPerKm).toBeCloseTo(333, -1);
    expect(stats.currentPaceSecPerKm).toBeCloseTo(333, -1);
  });

  it('ignores GPS jitter and teleport jumps', () => {
    const tracker = new RunTracker();
    const t0 = Date.now();
    tracker.add({ ...START, ts: t0 });
    // 1 m wobble — below the jitter threshold.
    tracker.add({ ...projectPoint(START, 0, 1), ts: t0 + 3000 });
    // 500 m in 1 s — impossible, must be dropped.
    const stats = tracker.add({ ...projectPoint(START, 0, 500), ts: t0 + 4000 });
    expect(stats.distanceM).toBe(0);
  });

  it('reports null paces before there is enough signal', () => {
    const tracker = new RunTracker();
    const stats = tracker.add({ ...START, ts: Date.now() });
    expect(stats.avgPaceSecPerKm).toBeNull();
    expect(stats.currentPaceSecPerKm).toBeNull();
  });
});

describe('maskPii', () => {
  it('masks Korean mobile numbers, intl numbers and emails', () => {
    expect(maskPii('연락처는 010-1234-5678이에요')).toBe('연락처는 ***-****-****이에요');
    expect(maskPii('call me +1 212 555 0100 ok')).toBe('call me ***-****-**** ok');
    expect(maskPii('mail: runner@example.com')).toBe('mail: ***@***');
  });

  it('leaves normal text untouched', () => {
    const text = '여의나루역 1번 출구에서 만나요! 5km 6:00 페이스';
    expect(maskPii(text)).toBe(text);
  });
});
