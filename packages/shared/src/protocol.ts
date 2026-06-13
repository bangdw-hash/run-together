/**
 * Realtime protocol between the mobile app and the gateway.
 * The server sends data only — never display text — so all copy is
 * translated client-side (see docs/ARCHITECTURE.md §7).
 */
import type { LatLng, LocationPing } from './geo';

export type SessionStatus = 'LIVE' | 'RENDEZVOUS' | 'TOGETHER' | 'ENDED';
export type Visibility = 'all' | 'off';

export interface RunnerProfile {
  nickname: string;
  /** declared pace, seconds per km (e.g. 360 = 6:00/km) */
  paceSecPerKm: number;
  visibility: Visibility;
}

/** What others may see about a live runner — approximate location only. */
export interface NearbyRunner {
  sessionId: string;
  nickname: string;
  paceSecPerKm: number;
  startedAtMs: number;
  /** snapped to a ~150 m grid for privacy */
  approxLoc: LatLng;
  distanceM: number;
  bearingDeg: number;
}

export interface RendezvousInfo {
  point: LatLng;
  /** ETA for this client, seconds */
  myEtaSec: number;
  /** ETA for the partner, seconds */
  partnerEtaSec: number;
}

export interface JoinIncoming {
  requestId: string;
  fromSessionId: string;
  nickname: string;
  paceSecPerKm: number;
  distanceM: number;
  message?: string;
  expiresAtMs: number;
}

/** Client → Server events. */
export interface ClientToServer {
  'session:start': (
    p: { profile: RunnerProfile; loc: LocationPing },
    ack: (res: { sessionId: string }) => void,
  ) => void;
  'session:ping': (p: { loc: LocationPing }) => void;
  'session:end': () => void;
  'nearby:subscribe': (p: { radiusM: number }) => void;
  'join:request': (
    p: { toSessionId: string; message?: string },
    ack: (res: { requestId: string } | { error: ProtocolError }) => void,
  ) => void;
  'join:respond': (p: { requestId: string; accept: boolean }) => void;
  /** In-run chat with the matched partner only. PII is masked server-side. */
  'chat:send': (p: { text: string }) => void;
}

export interface ChatMessage {
  fromSessionId: string;
  nickname: string;
  text: string;
  ts: number;
}

/** Server → Client events. */
export interface ServerToClient {
  'nearby:update': (runners: NearbyRunner[]) => void;
  'join:incoming': (req: JoinIncoming) => void;
  'join:result': (res: {
    requestId: string;
    accepted: boolean;
    partner?: { sessionId: string; nickname: string };
  }) => void;
  'rendezvous:update': (info: RendezvousInfo) => void;
  'partner:ping': (p: { loc: LocationPing }) => void;
  'rendezvous:met': () => void;
  'partner:ended': () => void;
  /** Delivered to both members of the pair (sender gets the masked echo). */
  'chat:message': (m: ChatMessage) => void;
}

export type ProtocolError =
  | 'NO_SESSION'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_BUSY'
  | 'SELF_REQUEST'
  | 'DUPLICATE_REQUEST';

/** Join requests expire after this many milliseconds. */
export const JOIN_REQUEST_TTL_MS = 60_000;
/** Mutual distance below which the pair is considered "met". */
export const MET_DISTANCE_M = 50;
/** Default discovery radius. */
export const DEFAULT_RADIUS_M = 3_000;
