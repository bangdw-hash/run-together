/**
 * Rendezvous (intercept) computation — the signature mechanic of Run Together.
 *
 * The host keeps running along their current heading; the joiner heads to a
 * point on the host's projected path chosen so both arrive at roughly the
 * same time. See docs/ARCHITECTURE.md §4.2.
 */
import {
  bearingDeg,
  haversineM,
  projectPoint,
  type LatLng,
  type LocationPing,
} from './geo';

export interface Motion {
  speedMps: number;
  headingDeg: number;
}

/** Below this speed the host is treated as stationary. */
const MIN_MOVING_MPS = 0.5;
/** How far ahead we project the host, and the search step. */
const HORIZON_SEC = 900;
const STEP_SEC = 15;

/**
 * Estimate current speed and heading from the most recent track points.
 * Returns null when the track is too short or too stale to be meaningful.
 */
export function estimateMotion(track: LocationPing[]): Motion | null {
  if (track.length < 2) return null;
  const recent = track.slice(-5);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const dtSec = (last.ts - first.ts) / 1000;
  if (dtSec < 2) return null;
  const distM = haversineM(first, last);
  return { speedMps: distM / dtSec, headingDeg: bearingDeg(first, last) };
}

export interface RendezvousResult {
  point: LatLng;
  /** time for the host to reach the point, seconds */
  hostEtaSec: number;
  /** time for the joiner to reach the point, seconds */
  joinerEtaSec: number;
}

/**
 * Pick the point on the host's projected path that minimizes the difference
 * between the host's and the joiner's arrival times.
 *
 * Falls back to "meet the host where they are" when the host is (nearly)
 * stationary or their motion cannot be estimated yet.
 */
export function computeRendezvous(
  hostTrack: LocationPing[],
  joinerLoc: LatLng,
  joinerSpeedMps: number,
): RendezvousResult {
  const hostLoc = hostTrack[hostTrack.length - 1];
  const motion = estimateMotion(hostTrack);
  const joinerSpeed = Math.max(0.3, joinerSpeedMps);

  if (!motion || motion.speedMps < MIN_MOVING_MPS) {
    return {
      point: { lat: hostLoc.lat, lng: hostLoc.lng },
      hostEtaSec: 0,
      joinerEtaSec: haversineM(joinerLoc, hostLoc) / joinerSpeed,
    };
  }

  let best: RendezvousResult | null = null;
  let bestScore = Infinity;
  for (let t = 0; t <= HORIZON_SEC; t += STEP_SEC) {
    const point = projectPoint(hostLoc, motion.headingDeg, motion.speedMps * t);
    const joinerEtaSec = haversineM(joinerLoc, point) / joinerSpeed;
    const score = Math.abs(t - joinerEtaSec);
    if (score < bestScore) {
      bestScore = score;
      best = { point, hostEtaSec: t, joinerEtaSec };
    }
  }
  return best!;
}
