# 🏃 Run Together (RunMatch)

**위치 기반 즉흥 러닝 매칭 앱** — 약속 없이, 지금 달리는 사람과 지금 합류한다.
A location-based spontaneous running matching app: no plans, just go out and join someone running *right now*. 한국어/English 지원.

| 문서 | 내용 |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 설계도 (한국어) — 비전·아키텍처·알고리즘·안전 설계 |
| [docs/ARCHITECTURE.en.md](docs/ARCHITECTURE.en.md) | Architecture (English) |
| [docs/WORK_ORDER.md](docs/WORK_ORDER.md) | 작업 지시서 원문 + **구현 현황 매핑** |
| [docs/USER_TASKS.md](docs/USER_TASKS.md) | **직접 하셔야 할 일** (키 발급·계약·법적 절차 체크리스트) |
| [supabase/README.md](supabase/README.md) | 프로덕션 백엔드 배포 가이드 |

## 구조

```
apps/mobile/      Expo(React Native) 앱 — ko/en i18n, 레이더 탐색, 합류 내비게이션, 데모 모드
server/           실시간 게이트웨이 (Node + Socket.IO) — 근접 탐색·합류 요청·요격 지점 계산
packages/shared/  공유 타입·지오 유틸·합류(intercept) 알고리즘 (앱/서버 공용, 테스트 포함)
supabase/         프로덕션 백엔드 — PostGIS 스키마, RLS, 매칭 알고리즘 RPC, Edge Functions
docs/             설계도 및 체크리스트
```

## 빠른 시작

```bash
npm install
npm test            # 매칭·합류 엔진 + 소켓 프로토콜 테스트 (11개)
npm run server      # 실시간 게이트웨이 :4000
npm run mobile      # Expo 시작 → Expo Go로 QR 스캔
```

- 앱은 서버 미설정 시 **데모 모드**로 동작: 가상 러너 탐색 → 같이 뛰기 요청 → 수락 →
  합류 지점 안내 → 합류 완료까지 전체 흐름을 혼자서 체험 가능.
- 설정 화면에서 서버 주소를 넣으면 휴대폰 여러 대로 실제 상호 매칭 테스트.
- 위치 권한이 없으면(시뮬레이터 등) 여의도 한강공원 가상 조깅으로 대체.

## 핵심 메커니즘

1. 달리기 시작 → 내 위치가 **150m 근사 좌표**로만 주변에 노출 (정확 좌표는 수락 후에만)
2. 지금 달리는 중인 러너를 레이더/지도에서 발견 → **"같이 뛰어요"** 요청
3. 수락 시 서버가 두 러너의 위치·방향·페이스로 **요격(intercept) 합류 지점** 계산
4. 양쪽에 실시간 방향·거리·ETA 안내 → 50m 이내 접근 시 **합류 완료** 🎉

프로덕션 매칭(Supabase)은 ①페이스 호환(±30초/km) ②러닝 목적 일치 ③2km 근접 우선순위로
자동 매칭하고, 두 사람 중간의 **공개 장소**(공원 입구·역 출구)를 만남 지점으로 추천합니다.

## CI

GitHub Actions가 push/PR마다 전체 타입체크와 테스트를 자동 실행합니다 (`.github/workflows/ci.yml`).
