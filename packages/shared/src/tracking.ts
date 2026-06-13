/**
 * GPS run tracking (work order §4): accumulates distance and derives
 * average / current pace from location pings, with basic jitter filtering.
 */
import { haversineM, type LocationPing } from './geo';

/** Moves shorter than this are treated as GPS jitter and ignored. */
const MIN_STEP_M = 2;
/** Faster than this (m/s) is a GPS jump, not running. */
const MAX_SPEED_MPS = 12;
/** Window for "current pace". */
const CURRENT_PACE_WINDOW_MS = 60_000;

export interface TrackStats {
  distanceM: number;
  elapsedSec: number;
  /** seconds per km over the whole run; null until 50 m covered */
  avgPaceSecPerKm: number | null;
  /** seconds per km over the last minute; null until enough signal */
  currentPaceSecPerKm: number | null;
}

interface AcceptedPing extends LocationPing {
  cumulativeM: number;
}

export class RunTracker {
  private pings: AcceptedPing[] = [];
  private startTs: number | null = null;

  add(ping: LocationPing): TrackStats {
    if (this.startTs === null) this.startTs = ping.ts;
    const last = this.pings[this.pings.length - 1];

    if (!last) {
      this.pings.push({ ...ping, cumulativeM: 0 });
      return this.stats(ping.ts);
    }

    const dtSec = (ping.ts - last.ts) / 1000;
    const stepM = haversineM(last, ping);
    const tooFast = dtSec > 0 && stepM / dtSec > MAX_SPEED_MPS;
    if (ping.ts <= last.ts || stepM < MIN_STEP_M || tooFast) {
      return this.stats(ping.ts);
    }

    this.pings.push({ ...ping, cumulativeM: last.cumulativeM + stepM });
    // Cap memory on long runs: thin to one ping per ~2 s equivalent.
    if (this.pings.length > 10_000) this.pings.splice(1, 1);
    return this.stats(ping.ts);
  }

  stats(nowTs?: number): TrackStats {
    const last = this.pings[this.pings.length - 1];
    const ts = nowTs ?? last?.ts ?? this.startTs ?? Date.now();
    const distanceM = last?.cumulativeM ?? 0;
    const elapsedSec = this.startTs !== null ? (ts - this.startTs) / 1000 : 0;

    const avgPaceSecPerKm =
      distanceM >= 50 ? (elapsedSec / distanceM) * 1000 : null;

    let currentPaceSecPerKm: number | null = null;
    if (last) {
      const cutoff = last.ts - CURRENT_PACE_WINDOW_MS;
      let anchor = this.pings[0];
      for (let i = this.pings.length - 1; i >= 0; i--) {
        if (this.pings[i].ts <= cutoff) {
          anchor = this.pings[i];
          break;
        }
        anchor = this.pings[i];
      }
      const windowM = last.cumulativeM - anchor.cumulativeM;
      const windowSec = (last.ts - anchor.ts) / 1000;
      if (windowM >= 20 && windowSec >= 10) {
        currentPaceSecPerKm = (windowSec / windowM) * 1000;
      }
    }

    return { distanceM, elapsedSec, avgPaceSecPerKm, currentPaceSecPerKm };
  }
}
