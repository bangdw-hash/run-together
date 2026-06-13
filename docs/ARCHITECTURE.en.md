# Run Together — Architecture

> A location-based **spontaneous running matching** app. Not a pre-scheduled running crew:
> the core idea is *"I just went out for a run — I can see people running near me right now,
> and I can join them on the spot."*
>
> 한국어 버전: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. Product Vision

### 1.1 Problem

- Existing running communities (crews, meetup apps) are **reservation-based**: date, time, and
  place are fixed in advance.
- But running is an impulsive activity. "The weather is nice, let's go run *now*" is the most
  common scenario — and at that moment there is no way to find a partner.
- Running alone is less motivating, and night running raises safety concerns.

### 1.2 Solution — the Spontaneous Join mechanism

1. When I start running, the app broadcasts me as **"running right now"** to people nearby
   (anonymous, approximate location only).
2. Other users see, on a map/radar, **people who are running at this very moment** — their pace,
   elapsed time, and rough distance.
3. I send a lightweight **"run together" request** to a runner I like.
4. If they **accept**, precise live locations are shared between the two of us only, and the
   server computes a **rendezvous point** from both runners' positions, headings, and paces.
5. Both sides get live guidance — "head this way, you'll meet in N minutes" — converge, and run together.
6. After the run: kudos, follow, or block/report.

### 1.3 Differentiation (dating-app-like energy)

| Existing running apps | Run Together |
|---|---|
| Tracking-centric (Strava, NRC) | **People-centric** |
| Pre-scheduled meetups (crew apps) | **Right now, join in the field** |
| Static friend lists | Live "running now" feed — like matching cards |
| A map you look at alone | Live **converging navigation** toward each other after accept |

UX energy: immediacy (*now*), low-friction request/accept (swipe-level), the thrill of
convergence ("meet 300m ahead!"), and post-run social feedback (kudos).

### 1.4 Global support

- Launch languages: **Korean / English** (i18n layer allows unlimited expansion).
- Units: km / mile; pace min/km ↔ min/mi conversion.
- Map/geocoding constraints differ per country: Kakao/Naver in Korea (map-data export limits),
  Mapbox/Google globally → the map SDK is abstracted behind an adapter.

---

## 2. Core User Flow

```
[Home]                     [Live radar/map]                 [Join]
 │                              │                              │
 │ tap "Run now"                │ browse nearby runner cards   │ rendezvous point + bearing/distance
 ▼                              ▼                              ▼
Start running ────────▶ Send "run together" ────────▶ On accept, both sides get
(location broadcast)     request to a runner            live convergence navigation
                                │                              │
                                │ (other side: accept/decline) ▼
                                ▼                         Meet → run together
                          On decline/expiry, browse on     → end → kudos/follow
```

RunSession state machine:

```
IDLE ─ start ─▶ LIVE ─┬─ join request sent/received ─▶ PENDING_JOIN ─ accept ─▶ RENDEZVOUS
                      │                                     │ decline/timeout
                      │◀────────────────────────────────────┘
RENDEZVOUS ─ mutual distance < 50m ─▶ TOGETHER ─ end ─▶ ENDED (summary/kudos)
LIVE ─ end ─▶ ENDED
```

---

## 3. System Architecture

```
┌─────────────────────────────┐
│  Mobile app (Expo / React Native, iOS+Android)             │
│  - expo-location (foreground/background)                   │
│  - i18next (ko/en) + expo-localization                     │
│  - Map adapter (Mapbox │ Google │ Kakao) + radar view      │
│  - Socket.IO client (realtime), REST (profile/history)     │
└──────────────┬──────────────┘
               │ WebSocket + HTTPS
┌──────────────▼──────────────┐
│  Realtime gateway (Node.js + Socket.IO)                    │
│  - session/location pings, proximity queries               │
│  - join request/accept routing                             │
│  - rendezvous (intercept) computation engine               │
└──────┬───────────────┬──────┘
       │               │
┌──────▼──────┐ ┌──────▼─────────────┐
│ Geo index    │ │ Persistent store    │
│ Redis GEO /  │ │ PostgreSQL+PostGIS  │
│ H3 buckets   │ │ (users, history,    │
│ (live loc)   │ │  reports, kudos)    │
└─────────────┘ └────────────────────┘
       │
┌──────▼──────────────────────┐
│ Push (FCM/APNs) — runner nearby, join request arrived      │
└─────────────────────────────┘
```

### 3.1 MVP (this repo) vs production

| Component | MVP (this repo) | Production |
|---|---|---|
| Live location store | in-memory Map + haversine | Redis GEO or Uber H3 cell index |
| Persistence | none (ephemeral sessions) | PostgreSQL + PostGIS |
| Auth | nickname only (anonymous) | OAuth (Apple/Google/Kakao) + phone |
| Map | radar view (relative coords) | Mapbox (global) / Kakao (KR) adapter |
| Push | none | FCM/APNs |
| Deploy | single local node | horizontally scaled gateway + Redis pub/sub |

The MVP's **socket protocol and matching/rendezvous algorithms are production-shaped**;
only the storage layer needs swapping to scale.

### 3.2 Scaling

- Keep Socket.IO gateways stateless, live locations in Redis → horizontal scale-out.
- Proximity: coarse filter by H3 resolution-8 (~0.7 km²) cells, then precise haversine.
- Adaptive ping interval: 5s (LIVE) / 2s (converging in RENDEZVOUS) to save battery.

---

## 4. Core Algorithms

### 4.1 Nearby runner query

- Input: my location, radius (default 3 km).
- Returns LIVE sessions within radius whose visibility settings allow exposure, sorted by distance.
- **Privacy**: before accept, only coordinates **snapped to a ~150 m grid** are exposed.
  Distance/bearing are computed from the snapped point, so precise tracking is impossible.

### 4.2 Rendezvous (intercept) computation

The signature feature. The host keeps running; the joiner **intercepts the host's future position**.

```
Input: host's recent track (coords + timestamps) → speed v_h, heading θ
       joiner's position, joiner speed v_j (declared pace, default 6:00/km)

for t in 0 .. 15 min (15 s steps):
    P(t)   = host position projected along θ by v_h·t
    t_join = dist(joiner, P(t)) / v_j      # joiner's travel time to P(t)
    score  = |t - t_join|                  # best when both arrive simultaneously

pick optimal t* → rendezvous = P(t*), ETAs = max(t*, t_join)
```

- Recomputed every 30 s with a re-estimated heading from the latest track (handles turns).
- When mutual distance < 50 m → "met" → TOGETHER state.
- Implementation: [`packages/shared/src/rendezvous.ts`](../packages/shared/src/rendezvous.ts), unit-tested (shared by the server and the app's demo mode).

### 4.3 Match quality (roadmap)

- Pace compatibility: warn when paces differ by > 1 min/km.
- Preferences: same-gender-only mode (night safety), distance-band tags (5k/10k/long).
- Reputation: no-show/abandon rate and kudos ratio feed a trust score.

---

## 5. Data Model

```
User          { id, nickname, locale(ko|en), units(km|mi), declaredPaceSecPerKm,
                visibility(all|same-gender|off), trustScore, createdAt }
RunSession    { id, userId, status(LIVE|RENDEZVOUS|TOGETHER|ENDED),
                startedAt, endedAt, distanceM, partnerSessionId? }
LocationPing  { sessionId, lat, lng, ts }            # live: last N kept in memory/Redis
JoinRequest   { id, fromSessionId, toSessionId, message?, status(PENDING|ACCEPTED|
                DECLINED|EXPIRED), createdAt }       # 60 s TTL
Rendezvous    { sessionA, sessionB, point{lat,lng}, etaASec, etaBSec, computedAt }
Kudos         { fromUserId, toUserId, sessionId }
Report/Block  { reporterId, targetId, reason, ts }
```

### 5.1 Realtime protocol (Socket.IO events)

Type definitions: [`packages/shared/src/protocol.ts`](../packages/shared/src/protocol.ts)

| Dir | Event | Payload | Description |
|---|---|---|---|
| C→S | `session:start` | profile, loc | start running, enter LIVE |
| C→S | `session:ping` | loc | location update (every 5 s) |
| C→S | `session:end` | — | end run |
| C→S | `nearby:subscribe` | radiusM | subscribe to nearby runner stream |
| S→C | `nearby:update` | runner[] (approx coords) | nearby runners (every 3 s) |
| C→S | `join:request` | toSessionId, message | request to join |
| S→C | `join:incoming` | from info | request received |
| C→S | `join:respond` | requestId, accept | accept/decline |
| S→C | `join:result` | accepted, rendezvous? | result to requester |
| S→C | `rendezvous:update` | point, etaA, etaB | rendezvous refresh (both sides) |
| S→C | `partner:ping` | loc (precise) | precise mutual location, post-accept only |
| S→C | `rendezvous:met` | — | converged within 50 m |

---

## 6. Safety & Privacy (first-class design)

Location + meeting strangers means safety *is* the product.

1. **Pre-accept location protection**: ~150 m grid snapping; auto-mask 500 m around home (roadmap).
2. **Mutual consent**: precise location only after bidirectional accept, only for that session.
3. **Instant block/report**: ≤ 2 taps from any screen; blocked pairs never see each other again.
4. **Women's safety**: same-gender-only mode, suggested on by default at night.
5. **Ephemeral sessions**: on run end, only stats (distance/time) persist; coordinate tracks are opt-in.
6. **Abuse control**: 60 s request expiry, rate-limiting repeatedly declined users, trust score.

---

## 7. i18n Design

- Stack: `i18next` + `react-i18next` + `expo-localization`.
- Resources: [`apps/mobile/src/i18n/ko.json`](../apps/mobile/src/i18n/ko.json), [`en.json`](../apps/mobile/src/i18n/en.json).
- Auto-detect device language → manual override in Settings (persisted).
- Units (km/mi) are a separate setting, independent of language; the pace formatter follows it.
- The server sends **codes/data only, never display text** → all copy is translated client-side
  (adding a language requires zero server changes).

---

## 8. Monetization (roadmap)

- Free: basic matching, 3 km radius, 1 join partner.
- Premium: larger radius, group joins (3+), advanced preference filters, deep run analytics.
- Local partnerships: cafés/stores near running routes surfaced as rendezvous suggestions.

---

## 9. Roadmap

| Phase | Scope |
|---|---|
| **M0 (this repo)** | architecture docs, socket protocol, matching/rendezvous engine (tested), Expo MVP (ko/en, radar, join flow) |
| M1 | real map SDKs (Mapbox/Kakao), auth, PostgreSQL+Redis, push notifications |
| M2 | safety hardening (trust score, same-gender mode), group joins (3+), run history/feed |
| M3 | global launch (more languages), premium subscription, partnerships |

---

## 10. Repository Layout

```
run-together/
├── docs/                     # this architecture doc (ko/en)
├── packages/shared/          # shared types & geo utils (app/server)
│   └── src/{protocol,geo}.ts
├── server/                   # realtime gateway (Node + Socket.IO)
│   └── src/{index,store,rendezvous,handlers}.ts + tests
└── apps/mobile/              # Expo (React Native) app
    └── src/{i18n,screens,components,lib}/
```
