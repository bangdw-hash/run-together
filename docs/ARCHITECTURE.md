# Run Together (런투게더) — 설계도

> 위치 기반 **즉흥 러닝 매칭** 앱. 미리 약속을 잡고 모이는 러닝 크루가 아니라,
> "지금 당장 달리러 나갔는데, 근처에 지금 달리고 있는 사람이 보이면 합류한다"가 핵심이다.
>
> English version: [ARCHITECTURE.en.md](./ARCHITECTURE.en.md)

---

## 1. 제품 비전

### 1.1 문제 정의

- 기존 러닝 커뮤니티(크루, 러닝 모임 앱)는 **사전 예약형**이다. 날짜·시간·장소를 미리 정하고 모인다.
- 그러나 러닝은 본질적으로 충동적인 활동이다. "지금 날씨 좋으니 나가서 뛰자"가 가장 흔한 시나리오인데,
  이 순간에는 같이 뛸 사람을 구할 방법이 없다.
- 혼자 뛰면 동기 부여가 약하고, 야간 러닝은 안전 문제도 있다.

### 1.2 해결책 — 즉흥 합류(Spontaneous Join) 메커니즘

1. 내가 달리기 시작하면 앱이 나를 **"지금 달리는 중"** 상태로 주변에 (익명·근사 위치로) 노출한다.
2. 다른 사용자는 지도/레이더에서 **지금 이 순간 달리고 있는 사람들**을 본다 — 페이스, 달린 시간, 대략적 거리.
3. 마음에 맞는 러너에게 **"같이 뛰어요" 요청**을 보낸다.
4. 상대가 **수락**하면 그때부터 서로 정확한 실시간 위치가 공유되고,
   서버가 두 사람의 현재 위치·진행 방향·페이스를 계산해 **합류 지점(rendezvous point)** 을 제안한다.
5. 양쪽 모두 "어느 방향으로 몇 분 가면 만난다"는 안내를 받고 합류해서 같이 뛴다.
6. 러닝 종료 후 서로 칭찬(kudos)·팔로우·차단/신고가 가능하다.

### 1.3 차별점 (매칭 앱적 감성)

| 기존 러닝 앱 | Run Together |
|---|---|
| 기록 측정 중심 (Strava, Nike Run Club) | **사람 연결 중심** |
| 사전 예약 모임 (크루 앱) | **지금 즉시, 현장 합류** |
| 정적인 친구 목록 | 실시간 "지금 뛰는 사람" 피드 — 마치 매칭 앱의 카드처럼 |
| 혼자 보는 지도 | 수락 시 서로를 향해 수렴하는 **라이브 합류 내비게이션** |

젊은 에너지를 주는 UX 포인트: 즉시성(지금), 가벼운 신청/수락(스와이프 수준의 마찰),
만남의 설렘(합류 카운트다운, "300m 앞에서 만나요!"), 러닝 후 소셜 피드백(kudos).

### 1.4 글로벌 지원

- 출시 언어: **한국어 / 영어** (i18n 레이어로 추후 언어 무제한 확장).
- 단위: km / mile, 페이스 min/km ↔ min/mi 자동 변환.
- 지도·지오코딩은 국가별 제약 고려: 한국은 카카오/네이버 지도(국외 반출 제한), 글로벌은 Mapbox/Google.
  → 지도 SDK는 어댑터 패턴으로 추상화한다.

---

## 2. 핵심 사용자 흐름

```
[홈]                       [라이브 레이더/지도]                [합류]
 │                              │                              │
 │ "지금 달리기" 탭              │ 주변 러너 카드 보기            │ 합류 지점 + 방향/거리 안내
 ▼                              ▼                              ▼
달리기 시작 ──────────▶ 같이 뛰고 싶은 러너에게 ──────▶ 수락되면 양쪽에
(위치 브로드캐스트 시작)   "같이 뛰어요" 요청            실시간 합류 내비게이션
                                │                              │
                                │ (상대방: 수락/거절)            ▼
                                ▼                          합류 → 같이 러닝
                          거절/만료 시 다른 러너 탐색          → 종료 → kudos/팔로우
```

상태 머신 (RunSession):

```
IDLE ─ start ─▶ LIVE ─┬─ join request 수신/발신 ─▶ PENDING_JOIN ─ accept ─▶ RENDEZVOUS
                      │                                  │ decline/timeout
                      │                                  ▼
                      │◀─────────────────────────────── LIVE
                      │
RENDEZVOUS ─ 합류 확인(상호 50m 이내) ─▶ TOGETHER ─ end ─▶ ENDED(요약/kudos)
LIVE ─ end ─▶ ENDED
```

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────┐
│  모바일 앱 (Expo / React Native, iOS+Android)             │
│  - expo-location (포그라운드/백그라운드 위치)              │
│  - i18next (ko/en) + expo-localization                     │
│  - 지도 어댑터 (Mapbox │ Google │ Kakao) + 레이더 뷰        │
│  - Socket.IO client (실시간), REST (프로필/이력)            │
└──────────────┬──────────────┘
               │ WebSocket + HTTPS
┌──────────────▼──────────────┐
│  실시간 게이트웨이 (Node.js + Socket.IO)                   │
│  - 세션/위치 핑 수신, 근접 질의 응답                        │
│  - 합류 요청/수락 라우팅                                    │
│  - 합류 지점(rendezvous) 계산 엔진                          │
└──────┬───────────────┬──────┘
       │               │
┌──────▼──────┐ ┌──────▼─────────────┐
│ 지오 인덱스   │ │ 영속 저장소          │
│ Redis GEO /  │ │ PostgreSQL+PostGIS  │
│ H3 셀 버킷    │ │ (유저, 러닝 이력,    │
│ (라이브 위치) │ │  신고/차단, kudos)   │
└─────────────┘ └────────────────────┘
       │
┌──────▼──────────────────────┐
│ 푸시 (FCM/APNs) — 근처에 러너 등장, 합류 요청 도착 알림      │
└─────────────────────────────┘
```

### 3.1 MVP(이 저장소) vs 프로덕션

| 구성 요소 | MVP (이 저장소) | 프로덕션 |
|---|---|---|
| 라이브 위치 저장 | 인메모리 Map + 해버사인 근접 검색 | Redis GEO 또는 Uber H3 셀 인덱스 |
| 영속 저장 | 없음 (세션 휘발) | PostgreSQL + PostGIS |
| 인증 | 닉네임만 (익명) | OAuth(애플/구글/카카오) + 전화 인증 |
| 지도 | 레이더 뷰 (상대 좌표 시각화) | Mapbox(글로벌) / 카카오(한국) 어댑터 |
| 푸시 | 없음 | FCM/APNs |
| 배포 | 로컬 단일 노드 | 게이트웨이 수평 확장 + Redis pub/sub |

MVP의 **소켓 프로토콜과 매칭/합류 알고리즘은 프로덕션과 동일한 형태**로 설계되어 있어,
저장소 계층만 교체하면 확장된다.

### 3.2 확장 전략

- Socket.IO 게이트웨이는 무상태(stateless)로 두고 라이브 위치를 Redis에 저장 → 노드 수평 확장.
- 근접 질의는 H3 resolution 8(~0.7km²) 셀 버킷으로 1차 필터 후 정밀 해버사인 계산.
- 위치 핑 주기: 배터리 절약을 위해 5초(LIVE) / 2초(RENDEZVOUS 수렴 중) 적응형.

---

## 4. 핵심 알고리즘

### 4.1 근접 러너 탐색 (Nearby Query)

- 입력: 내 위치, 반경(기본 3km).
- 라이브 세션 중 반경 내, 그리고 노출 설정(visibility)이 허용된 세션을 거리순 정렬해 반환.
- **프라이버시**: 수락 전에는 정확 좌표 대신 **~150m 그리드로 스냅한 근사 좌표**만 노출.
  거리·방향은 근사 좌표 기준으로 계산되므로 정확한 위치 추적이 불가능하다.

### 4.2 합류 지점 계산 (Rendezvous / Intercept)

핵심 차별 기능. 호스트(달리는 중)는 멈추지 않고, 조이너가 호스트의 **미래 위치를 요격(intercept)** 한다.

```
입력: 호스트 최근 트랙(좌표+타임스탬프) → 속도 v_h, 진행 방위각 θ
      조이너 현재 위치, 조이너 속도 v_j (선언 페이스 또는 기본 6:00/km)

for t in 0 .. 15분 (15초 간격):
    P(t)   = 호스트 위치를 θ 방향으로 v_h·t 만큼 투영한 점
    t_join = dist(조이너, P(t)) / v_j        # 조이너가 P(t)까지 가는 시간
    score  = |t - t_join|                    # 동시에 도착할수록 좋음

최적 t* 선택 → 합류 지점 = P(t*), 양쪽 ETA = max(t*, t_join)
```

- 호스트가 경로를 꺾으면 최근 트랙으로 방위각을 재추정해 30초마다 재계산.
- 상호 거리 50m 이내로 들어오면 "합류 완료" 처리 → TOGETHER 상태.
- 구현: [`packages/shared/src/rendezvous.ts`](../packages/shared/src/rendezvous.ts), 단위 테스트 포함 (앱의 데모 모드와 서버가 공유).

### 4.3 매칭 품질 (로드맵)

- 페이스 호환 필터: 페이스 차이가 km당 1분 이상이면 경고 표시.
- 선호 설정: 성별 동일 매칭 옵션(야간 안전), 거리대(5k/10k/장거리) 태그.
- 평판: 합류 후 노쇼/이탈률, kudos 비율로 신뢰 점수.

---

## 5. 데이터 모델

```
User          { id, nickname, locale(ko|en), units(km|mi), declaredPaceSecPerKm,
                visibility(all|same-gender|off), trustScore, createdAt }
RunSession    { id, userId, status(LIVE|RENDEZVOUS|TOGETHER|ENDED),
                startedAt, endedAt, distanceM, partnerSessionId? }
LocationPing  { sessionId, lat, lng, ts }            # 라이브는 최근 N개만 메모리/Redis
JoinRequest   { id, fromSessionId, toSessionId, message?, status(PENDING|ACCEPTED|
                DECLINED|EXPIRED), createdAt }       # 60초 TTL
Rendezvous    { sessionA, sessionB, point{lat,lng}, etaASec, etaBSec, computedAt }
Kudos         { fromUserId, toUserId, sessionId }
Report/Block  { reporterId, targetId, reason, ts }
```

### 5.1 실시간 프로토콜 (Socket.IO 이벤트)

타입 정의: [`packages/shared/src/protocol.ts`](../packages/shared/src/protocol.ts)

| 방향 | 이벤트 | 페이로드 | 설명 |
|---|---|---|---|
| C→S | `session:start` | profile, loc | 러닝 시작, LIVE 상태 진입 |
| C→S | `session:ping` | loc | 위치 갱신 (5초 주기) |
| C→S | `session:end` | — | 러닝 종료 |
| C→S | `nearby:subscribe` | radiusM | 주변 러너 스트림 구독 |
| S→C | `nearby:update` | runner[] (근사 좌표) | 주변 러너 목록 (3초 주기) |
| C→S | `join:request` | toSessionId, message | 합류 요청 |
| S→C | `join:incoming` | from 정보 | 요청 수신 알림 |
| C→S | `join:respond` | requestId, accept | 수락/거절 |
| S→C | `join:result` | accepted, rendezvous? | 요청자에게 결과 통보 |
| S→C | `rendezvous:update` | point, etaA, etaB | 합류 지점 갱신 (양쪽) |
| S→C | `partner:ping` | loc (정확 좌표) | 수락 후에만 상호 정확 위치 |
| S→C | `rendezvous:met` | — | 50m 이내 합류 완료 |

---

## 6. 안전 · 프라이버시 (필수 설계)

위치 기반 + 낯선 사람 만남이라는 특성상 안전이 곧 제품이다.

1. **수락 전 위치 보호**: 근사 좌표(150m 그리드)만 노출. 홈 위치 주변 500m는 자동 마스킹(로드맵).
2. **상호 동의**: 정확 위치 공유는 양방향 수락 이후에만, 해당 세션 동안만.
3. **즉시 차단/신고**: 모든 화면에서 2탭 이내. 차단 시 서로 영구 비노출.
4. **여성 안전 옵션**: 동성 매칭 전용 모드, 야간 시간대 기본 활성화 제안.
5. **세션 휘발성**: 러닝 종료 시 위치 이력은 통계(거리/시간)만 남기고 좌표 트랙은 사용자 선택 저장.
6. **노쇼/어뷰징 억제**: 요청 60초 만료, 반복 거절당한 사용자 rate-limit, 신뢰 점수.

---

## 7. i18n 설계

- 라이브러리: `i18next` + `react-i18next` + `expo-localization`.
- 리소스: [`apps/mobile/src/i18n/ko.json`](../apps/mobile/src/i18n/ko.json), [`en.json`](../apps/mobile/src/i18n/en.json).
- 기기 언어 자동 감지 → 설정 화면에서 수동 변경(저장됨).
- 단위(km/mi)는 언어와 독립적인 별도 설정. 페이스 포맷터가 단위 설정을 따른다.
- 서버는 텍스트를 보내지 않고 **코드/데이터만** 전송 → 모든 문구는 클라이언트에서 번역 (언어 추가 시 서버 무변경).

---

## 8. 수익화 (로드맵)

- 무료: 기본 매칭, 반경 3km, 동시 합류 1인.
- 프리미엄: 반경 확장, 그룹 합류(3인+), 매칭 선호 필터 고급 옵션, 러닝 통계 심화.
- 지역 제휴: 러닝 코스 주변 카페/스토어 합류 지점 제휴 노출.

---

## 9. 로드맵

| 단계 | 범위 |
|---|---|
| **M0 (이 저장소)** | 설계도, 소켓 프로토콜, 매칭/합류 엔진(테스트 포함), Expo 앱 MVP(ko/en, 레이더, 합류 흐름) |
| M1 | 실제 지도 SDK(Mapbox/카카오), 인증, PostgreSQL+Redis, 푸시 알림 |
| M2 | 안전 기능 고도화(신뢰 점수, 동성 매칭), 그룹 합류(3인+), 러닝 기록/피드 |
| M3 | 글로벌 출시(추가 언어), 프리미엄 구독, 제휴 |

---

## 10. 저장소 구조

```
run-together/
├── docs/                     # 이 설계도 (ko/en)
├── packages/shared/          # 공유 타입·지오 유틸 (앱/서버 공용)
│   └── src/{protocol,geo}.ts
├── server/                   # 실시간 게이트웨이 (Node + Socket.IO)
│   └── src/{index,store,rendezvous,handlers}.ts + 테스트
└── apps/mobile/              # Expo (React Native) 앱
    └── src/{i18n,screens,components,lib}/
```
