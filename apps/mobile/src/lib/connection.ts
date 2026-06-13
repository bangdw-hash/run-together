/**
 * Transport abstraction for the run session. Two implementations:
 *  - SocketConnection: talks to the realtime gateway (server/).
 *  - DemoConnection (demo.ts): fully local simulation so the app can be
 *    experienced without a server or other users nearby.
 */
import { io, type Socket } from 'socket.io-client';
import {
  DEFAULT_RADIUS_M,
  type ClientToServer,
  type JoinIncoming,
  type LocationPing,
  type NearbyRunner,
  type RendezvousInfo,
  type RunnerProfile,
  type ServerToClient,
} from '@run-together/shared';

export interface ConnectionEvents {
  onNearby(runners: NearbyRunner[]): void;
  onIncoming(req: JoinIncoming): void;
  onJoinResult(res: { requestId: string; accepted: boolean; partner?: { nickname: string } }): void;
  onRendezvous(info: RendezvousInfo): void;
  onPartnerPing(loc: LocationPing): void;
  onMet(): void;
  onPartnerEnded(): void;
}

export interface RunConnection {
  start(profile: RunnerProfile, loc: LocationPing): Promise<string>;
  ping(loc: LocationPing): void;
  requestJoin(toSessionId: string, message?: string): void;
  respond(requestId: string, accept: boolean): void;
  end(): void;
}

export class SocketConnection implements RunConnection {
  private socket: Socket<ServerToClient, ClientToServer>;

  constructor(serverUrl: string, events: ConnectionEvents) {
    this.socket = io(serverUrl, { transports: ['websocket'] });
    this.socket.on('nearby:update', events.onNearby);
    this.socket.on('join:incoming', events.onIncoming);
    this.socket.on('join:result', events.onJoinResult);
    this.socket.on('rendezvous:update', events.onRendezvous);
    this.socket.on('partner:ping', ({ loc }) => events.onPartnerPing(loc));
    this.socket.on('rendezvous:met', events.onMet);
    this.socket.on('partner:ended', events.onPartnerEnded);
  }

  start(profile: RunnerProfile, loc: LocationPing): Promise<string> {
    return new Promise((resolve) => {
      this.socket.emit('session:start', { profile, loc }, ({ sessionId }) => {
        this.socket.emit('nearby:subscribe', { radiusM: DEFAULT_RADIUS_M });
        resolve(sessionId);
      });
    });
  }

  ping(loc: LocationPing): void {
    this.socket.emit('session:ping', { loc });
  }

  requestJoin(toSessionId: string, message?: string): void {
    this.socket.emit('join:request', { toSessionId, message }, () => {});
  }

  respond(requestId: string, accept: boolean): void {
    this.socket.emit('join:respond', { requestId, accept });
  }

  end(): void {
    this.socket.emit('session:end');
    this.socket.close();
  }
}
