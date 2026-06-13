/**
 * Realtime gateway: wires the Socket.IO protocol to the session store and
 * the rendezvous engine. See packages/shared/src/protocol.ts for the wire
 * format and docs/ARCHITECTURE.md §5.1 for the event table.
 */
import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import {
  DEFAULT_RADIUS_M,
  JOIN_REQUEST_TTL_MS,
  MET_DISTANCE_M,
  haversineM,
  paceToMps,
  computeRendezvous,
  maskPii,
  type ClientToServer,
  type ServerToClient,
} from '@run-together/shared';
import { SessionStore, type Session } from './store.js';

const NEARBY_BROADCAST_MS = 3_000;
const RENDEZVOUS_REFRESH_MS = 30_000;

type IO = Server<ClientToServer, ServerToClient>;
type GatewaySocket = Socket<ClientToServer, ServerToClient>;

interface JoinRequest {
  id: string;
  fromSessionId: string;
  toSessionId: string;
  expiresAtMs: number;
}

export class Gateway {
  readonly store = new SessionStore();
  private requests = new Map<string, JoinRequest>();
  private radii = new Map<string, number>(); // socketId -> subscribed radius
  private nearbyTimer?: ReturnType<typeof setInterval>;

  constructor(private io: IO) {
    io.on('connection', (socket) => this.onConnection(socket));
    this.nearbyTimer = setInterval(() => this.broadcastNearby(), NEARBY_BROADCAST_MS);
    this.nearbyTimer.unref?.();
  }

  close(): void {
    if (this.nearbyTimer) clearInterval(this.nearbyTimer);
  }

  private onConnection(socket: GatewaySocket): void {
    socket.on('session:start', ({ profile, loc }, ack) => {
      const session = this.store.start(socket.id, profile, loc);
      ack({ sessionId: session.id });
    });

    socket.on('nearby:subscribe', ({ radiusM }) => {
      this.radii.set(socket.id, Math.min(radiusM, 10_000));
      const session = this.store.getBySocket(socket.id);
      if (session) this.sendNearby(socket, session);
    });

    socket.on('session:ping', ({ loc }) => {
      const session = this.store.getBySocket(socket.id);
      if (!session) return;
      this.store.ping(session.id, loc);
      if (session.partnerSessionId) this.onPartnerPing(session);
    });

    socket.on('join:request', ({ toSessionId, message }, ack) => {
      const from = this.store.getBySocket(socket.id);
      if (!from) return ack({ error: 'NO_SESSION' });
      if (from.id === toSessionId) return ack({ error: 'SELF_REQUEST' });
      const to = this.store.get(toSessionId);
      if (!to) return ack({ error: 'TARGET_NOT_FOUND' });
      if (to.status !== 'LIVE' || from.partnerSessionId) return ack({ error: 'TARGET_BUSY' });
      const duplicate = [...this.requests.values()].some(
        (r) => r.fromSessionId === from.id && r.toSessionId === to.id,
      );
      if (duplicate) return ack({ error: 'DUPLICATE_REQUEST' });

      const request: JoinRequest = {
        id: randomUUID(),
        fromSessionId: from.id,
        toSessionId: to.id,
        expiresAtMs: Date.now() + JOIN_REQUEST_TTL_MS,
      };
      this.requests.set(request.id, request);
      setTimeout(() => this.expireRequest(request.id), JOIN_REQUEST_TTL_MS).unref?.();

      this.io.to(to.socketId).emit('join:incoming', {
        requestId: request.id,
        fromSessionId: from.id,
        nickname: from.profile.nickname,
        paceSecPerKm: from.profile.paceSecPerKm,
        distanceM: haversineM(this.store.lastLoc(to), this.store.lastLoc(from)),
        message,
        expiresAtMs: request.expiresAtMs,
      });
      ack({ requestId: request.id });
    });

    socket.on('join:respond', ({ requestId, accept }) => {
      const request = this.requests.get(requestId);
      if (!request) return;
      const to = this.store.getBySocket(socket.id);
      if (!to || to.id !== request.toSessionId) return; // only the target may respond
      this.requests.delete(requestId);

      const from = this.store.get(request.fromSessionId);
      if (!from) return;

      if (!accept || to.partnerSessionId || from.partnerSessionId) {
        this.io.to(from.socketId).emit('join:result', { requestId, accepted: false });
        return;
      }

      this.store.pair(from, to);
      this.io.to(from.socketId).emit('join:result', {
        requestId,
        accepted: true,
        partner: { sessionId: to.id, nickname: to.profile.nickname },
      });
      // The accepter (host) keeps running; the requester intercepts.
      this.emitRendezvous(host(from, to), joiner(from, to));
    });

    socket.on('chat:send', ({ text }) => {
      const session = this.store.getBySocket(socket.id);
      const partner = session?.partnerSessionId
        ? this.store.get(session.partnerSessionId)
        : undefined;
      if (!session || !partner || !text.trim()) return;
      const message = {
        fromSessionId: session.id,
        nickname: session.profile.nickname,
        text: maskPii(text.trim()).slice(0, 1000),
        ts: Date.now(),
      };
      this.io.to(partner.socketId).emit('chat:message', message);
      this.io.to(session.socketId).emit('chat:message', message);
    });

    socket.on('session:end', () => this.teardown(socket.id));
    socket.on('disconnect', () => this.teardown(socket.id));
  }

  /** Forward precise location to the partner, check "met", refresh rendezvous. */
  private onPartnerPing(session: Session): void {
    const partner = session.partnerSessionId
      ? this.store.get(session.partnerSessionId)
      : undefined;
    if (!partner) return;

    this.io
      .to(partner.socketId)
      .emit('partner:ping', { loc: this.store.lastLoc(session) });

    const distance = haversineM(this.store.lastLoc(session), this.store.lastLoc(partner));
    if (distance <= MET_DISTANCE_M && session.status === 'RENDEZVOUS') {
      session.status = 'TOGETHER';
      partner.status = 'TOGETHER';
      this.io.to(session.socketId).emit('rendezvous:met');
      this.io.to(partner.socketId).emit('rendezvous:met');
      return;
    }

    const computedAt = session.rendezvousComputedAtMs ?? 0;
    if (session.status === 'RENDEZVOUS' && Date.now() - computedAt >= RENDEZVOUS_REFRESH_MS) {
      this.emitRendezvous(host(session, partner), joiner(session, partner));
    }
  }

  /** Compute the intercept point and send it to both sides. */
  private emitRendezvous(hostSession: Session, joinerSession: Session): void {
    const result = computeRendezvous(
      hostSession.track,
      this.store.lastLoc(joinerSession),
      paceToMps(joinerSession.profile.paceSecPerKm),
    );
    const now = Date.now();
    hostSession.rendezvousComputedAtMs = now;
    joinerSession.rendezvousComputedAtMs = now;

    this.io.to(hostSession.socketId).emit('rendezvous:update', {
      point: result.point,
      myEtaSec: result.hostEtaSec,
      partnerEtaSec: result.joinerEtaSec,
    });
    this.io.to(joinerSession.socketId).emit('rendezvous:update', {
      point: result.point,
      myEtaSec: result.joinerEtaSec,
      partnerEtaSec: result.hostEtaSec,
    });
  }

  private expireRequest(requestId: string): void {
    const request = this.requests.get(requestId);
    if (!request) return;
    this.requests.delete(requestId);
    const from = this.store.get(request.fromSessionId);
    if (from) {
      this.io
        .to(from.socketId)
        .emit('join:result', { requestId, accepted: false });
    }
  }

  private teardown(socketId: string): void {
    this.radii.delete(socketId);
    const partner = this.store.endBySocket(socketId);
    if (partner) this.io.to(partner.socketId).emit('partner:ended');
  }

  private broadcastNearby(): void {
    for (const [socketId] of this.radii) {
      const session = this.store.getBySocket(socketId);
      if (!session) continue;
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) this.sendNearby(socket, session);
    }
  }

  private sendNearby(socket: GatewaySocket, session: Session): void {
    const radius = this.radii.get(socket.id) ?? DEFAULT_RADIUS_M;
    socket.emit('nearby:update', this.store.nearby(session, radius));
  }
}

/** Pairing convention: the accepter hosts, the requester intercepts. */
function host(a: Session, b: Session): Session {
  return a.pairRole === 'host' ? a : b;
}
function joiner(a: Session, b: Session): Session {
  return a.pairRole === 'host' ? b : a;
}
