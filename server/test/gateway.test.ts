/**
 * End-to-end test of the realtime protocol over real sockets:
 * two clients start runs, discover each other, request/accept a join,
 * receive a rendezvous point, converge, and get "met".
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  projectPoint,
  type ClientToServer,
  type JoinIncoming,
  type NearbyRunner,
  type RendezvousInfo,
  type ServerToClient,
} from '@run-together/shared';
import { Gateway } from '../src/gateway.js';

type TestClient = ClientSocket<ServerToClient, ClientToServer>;

const YEOUIDO = { lat: 37.5283, lng: 126.9294 };

let httpServer: ReturnType<typeof createServer>;
let gateway: Gateway;
let url: string;

beforeAll(async () => {
  httpServer = createServer();
  const io = new Server<ClientToServer, ServerToClient>(httpServer);
  gateway = new Gateway(io);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  gateway.close();
  httpServer.close();
});

function connect(): Promise<TestClient> {
  return new Promise((resolve) => {
    const socket: TestClient = clientIo(url, { transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
  });
}

function once<T>(socket: TestClient, event: keyof ServerToClient): Promise<T> {
  return new Promise((resolve) => socket.once(event as never, resolve as never));
}

function startSession(socket: TestClient, nickname: string, loc: { lat: number; lng: number }) {
  return new Promise<string>((resolve) => {
    socket.emit(
      'session:start',
      {
        profile: { nickname, paceSecPerKm: 360, visibility: 'all' },
        loc: { ...loc, ts: Date.now() },
      },
      ({ sessionId }) => resolve(sessionId),
    );
  });
}

describe('gateway protocol', () => {
  it('runs the full discover → request → accept → rendezvous → met flow', async () => {
    const alice = await connect();
    const bob = await connect();
    try {
      await startSession(alice, 'alice', YEOUIDO);
      const bobLoc = projectPoint(YEOUIDO, 90, 800);
      const bobSessionId = await startSession(bob, 'bob', bobLoc);

      // Discovery: alice subscribes and sees bob with an approximate location.
      const nearbyPromise = once<NearbyRunner[]>(alice, 'nearby:update');
      alice.emit('nearby:subscribe', { radiusM: 3000 });
      const nearby = await nearbyPromise;
      expect(nearby).toHaveLength(1);
      expect(nearby[0].nickname).toBe('bob');
      expect(nearby[0].sessionId).toBe(bobSessionId);
      expect(nearby[0].distanceM).toBeGreaterThan(500);

      // Alice requests to join bob; bob receives and accepts.
      const incomingPromise = once<JoinIncoming>(bob, 'join:incoming');
      alice.emit('join:request', { toSessionId: bobSessionId, message: 'run together?' }, () => {});
      const incoming = await incomingPromise;
      expect(incoming.nickname).toBe('alice');
      expect(incoming.message).toBe('run together?');

      const resultPromise = once<{ accepted: boolean; partner?: { nickname: string } }>(
        alice,
        'join:result',
      );
      const aliceRdv = once<RendezvousInfo>(alice, 'rendezvous:update');
      const bobRdv = once<RendezvousInfo>(bob, 'rendezvous:update');
      bob.emit('join:respond', { requestId: incoming.requestId, accept: true });

      const result = await resultPromise;
      expect(result.accepted).toBe(true);
      expect(result.partner?.nickname).toBe('bob');

      // Both sides get the same rendezvous point with mirrored ETAs.
      const [a, b] = await Promise.all([aliceRdv, bobRdv]);
      expect(a.point).toEqual(b.point);
      expect(a.myEtaSec).toBeCloseTo(b.partnerEtaSec, 5);

      // Converge: alice pings right next to bob → both get "met".
      const aliceMet = once<void>(alice, 'rendezvous:met');
      const bobPing = once<{ loc: { lat: number } }>(bob, 'partner:ping');
      alice.emit('session:ping', { loc: { ...projectPoint(bobLoc, 0, 10), ts: Date.now() } });
      await Promise.all([aliceMet, bobPing]);

      // Ending one side notifies the partner.
      const ended = once<void>(bob, 'partner:ended');
      alice.emit('session:end');
      await ended;
    } finally {
      alice.close();
      bob.close();
    }
  });

  it('rejects join requests to unknown or own sessions', async () => {
    const solo = await connect();
    try {
      const sessionId = await startSession(solo, 'solo', YEOUIDO);
      const selfError = await new Promise((resolve) =>
        solo.emit('join:request', { toSessionId: sessionId }, resolve),
      );
      expect(selfError).toEqual({ error: 'SELF_REQUEST' });
      const missingError = await new Promise((resolve) =>
        solo.emit('join:request', { toSessionId: 'nope' }, resolve),
      );
      expect(missingError).toEqual({ error: 'TARGET_NOT_FOUND' });
    } finally {
      solo.close();
    }
  });
});
