/**
 * Demo mode: a local simulation of the gateway so the whole experience —
 * discovery, join request/accept, rendezvous convergence, "met" — works
 * with no server and no other users around. Uses the same shared
 * algorithms as the real server (snapToGrid, computeRendezvous).
 */
import {
  MET_DISTANCE_M,
  bearingDeg,
  computeRendezvous,
  haversineM,
  paceToMps,
  projectPoint,
  snapToGrid,
  type LatLng,
  type LocationPing,
  type NearbyRunner,
  type RunnerProfile,
} from '@run-together/shared';
import { SocketConnection, type ConnectionEvents, type RunConnection } from './connection';

const TICK_MS = 3_000;
const KO_NAMES = ['달리는하늘', '한강러너', '바람돌이', '새벽질주', '러닝하이'];
const EN_NAMES = ['NightPacer', 'RiverRunner', 'SwiftFox', 'DawnDash', 'MintStride'];

interface FakeRunner {
  sessionId: string;
  nickname: string;
  paceSecPerKm: number;
  startedAtMs: number;
  loc: LatLng;
  headingDeg: number;
  /** filled once the user is paired with this runner */
  track: LocationPing[];
}

export class DemoConnection implements RunConnection {
  private runners: FakeRunner[] = [];
  private myLoc!: LocationPing;
  private partner?: FakeRunner;
  private met = false;
  private lastRendezvousAt = 0;
  private timer?: ReturnType<typeof setInterval>;
  private timeouts: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private events: ConnectionEvents,
    private locale: 'ko' | 'en' = 'ko',
  ) {}

  async start(_profile: RunnerProfile, loc: LocationPing): Promise<string> {
    this.myLoc = loc;
    const names = this.locale === 'ko' ? KO_NAMES : EN_NAMES;
    this.runners = names.slice(0, 4).map((nickname, i) => ({
      sessionId: `demo-${i}`,
      nickname,
      paceSecPerKm: 300 + Math.round(Math.random() * 150),
      startedAtMs: Date.now() - (5 + Math.round(Math.random() * 30)) * 60_000,
      loc: projectPoint(loc, Math.random() * 360, 400 + Math.random() * 1800),
      headingDeg: Math.random() * 360,
      track: [],
    }));
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.emitNearby();

    // After a while, a nearby runner invites *you* — shows the receiving side.
    this.later(25_000, () => {
      const inviter = this.runners[1];
      if (!inviter || this.partner) return;
      this.events.onIncoming({
        requestId: `demo-req-${inviter.sessionId}`,
        fromSessionId: inviter.sessionId,
        nickname: inviter.nickname,
        paceSecPerKm: inviter.paceSecPerKm,
        distanceM: haversineM(this.myLoc, inviter.loc),
        message: this.locale === 'ko' ? '페이스 비슷해요! 같이 뛰어요 🏃' : 'Similar pace! Join me 🏃',
        expiresAtMs: Date.now() + 60_000,
      });
    });
    return 'demo-session-me';
  }

  ping(loc: LocationPing): void {
    this.myLoc = loc;
    if (this.partner && !this.met) this.checkConvergence();
  }

  requestJoin(toSessionId: string): void {
    const target = this.runners.find((r) => r.sessionId === toSessionId);
    if (!target || this.partner) return;
    // The fake runner thinks it over, then (usually) accepts.
    this.later(2_500, () => {
      const accepted = Math.random() > 0.15;
      this.events.onJoinResult({
        requestId: `demo-req-out`,
        accepted,
        partner: accepted ? { nickname: target.nickname } : undefined,
      });
      if (accepted) this.pairWith(target);
    });
  }

  respond(requestId: string, accept: boolean): void {
    if (!accept) return;
    const inviter = this.runners.find((r) => `demo-req-${r.sessionId}` === requestId);
    if (inviter && !this.partner) this.pairWith(inviter);
  }

  end(): void {
    if (this.timer) clearInterval(this.timer);
    this.timeouts.forEach(clearTimeout);
  }

  // ---- internals ----------------------------------------------------------

  private pairWith(runner: FakeRunner): void {
    this.partner = runner;
    this.met = false;
    runner.track = [
      { ...projectPoint(runner.loc, (runner.headingDeg + 180) % 360, 60), ts: Date.now() - 20_000 },
      { ...runner.loc, ts: Date.now() },
    ];
    this.emitRendezvous();
  }

  private emitRendezvous(): void {
    if (!this.partner) return;
    this.lastRendezvousAt = Date.now();
    const r = computeRendezvous(this.partner.track, this.myLoc, paceToMps(360));
    this.events.onRendezvous({
      point: r.point,
      myEtaSec: r.joinerEtaSec,
      partnerEtaSec: r.hostEtaSec,
    });
  }

  private tick(): void {
    // Everyone keeps running; wandering runners drift, the partner converges
    // toward the user so the demo always ends in a successful meetup.
    for (const r of this.runners) {
      const speed = paceToMps(r.paceSecPerKm);
      if (r === this.partner) {
        r.headingDeg = bearingDeg(r.loc, this.myLoc);
      } else if (Math.random() < 0.2) {
        r.headingDeg = (r.headingDeg + (Math.random() * 60 - 30) + 360) % 360;
      }
      r.loc = projectPoint(r.loc, r.headingDeg, speed * (TICK_MS / 1000) * (r === this.partner ? 3 : 1));
      if (r.track.length) {
        r.track.push({ ...r.loc, ts: Date.now() });
        if (r.track.length > 10) r.track.shift();
      }
    }

    if (this.partner) {
      this.events.onPartnerPing({ ...this.partner.loc, ts: Date.now() });
      this.checkConvergence();
      if (!this.met && Date.now() - this.lastRendezvousAt > 15_000) this.emitRendezvous();
    } else {
      this.emitNearby();
    }
  }

  private checkConvergence(): void {
    if (!this.partner || this.met) return;
    if (haversineM(this.myLoc, this.partner.loc) <= MET_DISTANCE_M) {
      this.met = true;
      this.events.onMet();
    }
  }

  private emitNearby(): void {
    const nearby: NearbyRunner[] = this.runners
      .map((r) => {
        const approxLoc = snapToGrid(r.loc);
        return {
          sessionId: r.sessionId,
          nickname: r.nickname,
          paceSecPerKm: r.paceSecPerKm,
          startedAtMs: r.startedAtMs,
          approxLoc,
          distanceM: haversineM(this.myLoc, approxLoc),
          bearingDeg: bearingDeg(this.myLoc, approxLoc),
        };
      })
      .sort((a, b) => a.distanceM - b.distanceM);
    this.events.onNearby(nearby);
  }

  private later(ms: number, fn: () => void): void {
    this.timeouts.push(setTimeout(fn, ms));
  }
}

export function createConnection(
  serverUrl: string | null,
  events: ConnectionEvents,
  locale: 'ko' | 'en',
): RunConnection {
  if (serverUrl && serverUrl.trim()) {
    return new SocketConnection(serverUrl.trim(), events);
  }
  return new DemoConnection(events, locale);
}
