import { describe, expect, it } from 'vitest';
import {
  computeRendezvous,
  estimateMotion,
  haversineM,
  paceToMps,
  projectPoint,
  type LocationPing,
} from '@run-together/shared';

/** Build a straight-line track heading `bearing` at `speedMps`. */
function track(
  start: { lat: number; lng: number },
  bearing: number,
  speedMps: number,
  pings = 5,
  intervalSec = 5,
): LocationPing[] {
  const t0 = Date.now() - pings * intervalSec * 1000;
  return Array.from({ length: pings }, (_, i) => {
    const p = projectPoint(start, bearing, speedMps * i * intervalSec);
    return { ...p, ts: t0 + i * intervalSec * 1000 };
  });
}

const YEOUIDO = { lat: 37.5283, lng: 126.9294 }; // Han River park, Seoul

describe('estimateMotion', () => {
  it('recovers speed and heading from a straight track', () => {
    const motion = estimateMotion(track(YEOUIDO, 90, 3)); // 3 m/s due east
    expect(motion).not.toBeNull();
    expect(motion!.speedMps).toBeCloseTo(3, 1);
    expect(motion!.headingDeg).toBeCloseTo(90, 0);
  });

  it('returns null for a single ping', () => {
    expect(estimateMotion(track(YEOUIDO, 0, 3, 1))).toBeNull();
  });
});

describe('computeRendezvous', () => {
  it('meets a stationary host at the host position', () => {
    const hostTrack: LocationPing[] = [{ ...YEOUIDO, ts: Date.now() }];
    const joiner = projectPoint(YEOUIDO, 0, 600); // 600 m north
    const r = computeRendezvous(hostTrack, joiner, paceToMps(360));
    expect(r.hostEtaSec).toBe(0);
    expect(haversineM(r.point, YEOUIDO)).toBeLessThan(1);
    // 600 m at 6:00/km pace ≈ 216 s
    expect(r.joinerEtaSec).toBeCloseTo(216, -1);
  });

  it('intercepts a moving host so both arrive at roughly the same time', () => {
    // Host runs east at 3 m/s; joiner stands 1 km north of the host's path
    // and runs a faster pace, so an intercept exists within the horizon.
    const hostTrack = track(YEOUIDO, 90, 3);
    const joinerLoc = projectPoint(hostTrack[hostTrack.length - 1], 0, 1000);
    const joinerSpeed = paceToMps(240); // ~4.17 m/s

    const r = computeRendezvous(hostTrack, joinerLoc, joinerSpeed);

    // Arrival times converge (within ~one search step).
    expect(Math.abs(r.hostEtaSec - r.joinerEtaSec)).toBeLessThanOrEqual(20);
    // The point lies ahead of the host, not behind.
    expect(r.hostEtaSec).toBeGreaterThan(0);
    // And it sits on the host's projected path.
    const expected = projectPoint(
      hostTrack[hostTrack.length - 1],
      90,
      3 * r.hostEtaSec,
    );
    expect(haversineM(r.point, expected)).toBeLessThan(20);
  });

  it('handles a very slow joiner without diverging', () => {
    const hostTrack = track(YEOUIDO, 180, 2.5);
    const joinerLoc = projectPoint(YEOUIDO, 180, 2000); // 2 km ahead on the path
    const r = computeRendezvous(hostTrack, joinerLoc, paceToMps(600));
    expect(r.point.lat).toBeTypeOf('number');
    expect(Number.isFinite(r.joinerEtaSec)).toBe(true);
  });
});
