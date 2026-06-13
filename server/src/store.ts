/**
 * In-memory live-session store (MVP). Production swaps this for
 * Redis GEO / H3 cell buckets — see docs/ARCHITECTURE.md §3.1.
 */
import { randomUUID } from 'node:crypto';
import {
  bearingDeg,
  haversineM,
  snapToGrid,
  type LocationPing,
  type NearbyRunner,
  type RunnerProfile,
  type SessionStatus,
} from '@run-together/shared';

const TRACK_KEEP = 10;

export interface Session {
  id: string;
  socketId: string;
  profile: RunnerProfile;
  status: SessionStatus;
  track: LocationPing[];
  startedAtMs: number;
  partnerSessionId?: string;
  /** Set while paired. The host keeps running; the joiner intercepts. */
  pairRole?: 'host' | 'joiner';
  rendezvousComputedAtMs?: number;
}

export class SessionStore {
  private sessions = new Map<string, Session>();
  private bySocketId = new Map<string, string>();

  start(socketId: string, profile: RunnerProfile, loc: LocationPing): Session {
    // One live session per connection: a re-start replaces the previous one.
    this.endBySocket(socketId);
    const session: Session = {
      id: randomUUID(),
      socketId,
      profile,
      status: 'LIVE',
      track: [loc],
      startedAtMs: loc.ts,
    };
    this.sessions.set(session.id, session);
    this.bySocketId.set(socketId, session.id);
    return session;
  }

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getBySocket(socketId: string): Session | undefined {
    const id = this.bySocketId.get(socketId);
    return id ? this.sessions.get(id) : undefined;
  }

  ping(sessionId: string, loc: LocationPing): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'ENDED') return undefined;
    session.track.push(loc);
    if (session.track.length > TRACK_KEEP) session.track.shift();
    return session;
  }

  lastLoc(session: Session): LocationPing {
    return session.track[session.track.length - 1];
  }

  pair(joiner: Session, host: Session): void {
    joiner.partnerSessionId = host.id;
    host.partnerSessionId = joiner.id;
    joiner.pairRole = 'joiner';
    host.pairRole = 'host';
    joiner.status = 'RENDEZVOUS';
    host.status = 'RENDEZVOUS';
  }

  /** Ends a session and returns its (now unpaired) partner, if any. */
  end(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.status = 'ENDED';
    this.sessions.delete(sessionId);
    this.bySocketId.delete(session.socketId);
    if (!session.partnerSessionId) return undefined;
    const partner = this.sessions.get(session.partnerSessionId);
    if (partner) {
      partner.partnerSessionId = undefined;
      partner.pairRole = undefined;
      partner.status = 'LIVE';
    }
    return partner;
  }

  endBySocket(socketId: string): Session | undefined {
    const id = this.bySocketId.get(socketId);
    return id ? this.end(id) : undefined;
  }

  /**
   * Live, visible runners within `radiusM` of the viewer, nearest first.
   * Locations are snapped to a ~150 m grid: precise coordinates are never
   * exposed before mutual accept.
   */
  nearby(viewer: Session, radiusM: number): NearbyRunner[] {
    const viewerLoc = this.lastLoc(viewer);
    const result: NearbyRunner[] = [];
    for (const s of this.sessions.values()) {
      if (s.id === viewer.id) continue;
      if (s.status !== 'LIVE') continue;
      if (s.profile.visibility !== 'all') continue;
      const approxLoc = snapToGrid(this.lastLoc(s));
      const distanceM = haversineM(viewerLoc, approxLoc);
      if (distanceM > radiusM) continue;
      result.push({
        sessionId: s.id,
        nickname: s.profile.nickname,
        paceSecPerKm: s.profile.paceSecPerKm,
        startedAtMs: s.startedAtMs,
        approxLoc,
        distanceM,
        bearingDeg: bearingDeg(viewerLoc, approxLoc),
      });
    }
    return result.sort((a, b) => a.distanceM - b.distanceM);
  }

  all(): Session[] {
    return [...this.sessions.values()];
  }
}
