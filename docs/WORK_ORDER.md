# 작업 지시서 (원문) — RunMatch: 실시간 즉흥 러닝 매칭 앱

> 이 문서는 발주자가 작성한 작업 지시서 원문입니다. 구현 현황 매핑은 아래
> [구현 현황](#구현-현황)을, 시스템 설계는 [ARCHITECTURE.md](./ARCHITECTURE.md)를 참고하세요.

## 1. 제품 개요
- 목적: 사용자가 '지금 당장' 함께 뛸 러너를 3분 이내에 찾아주는 위치 기반 실시간 매칭 앱
- 핵심 가치: 매칭 속도 × 안전 신뢰 × 재방문 동기
- 타겟: 도심 러닝 인구(20~40대), 러닝 크루 미가입 개인 러너
- 수익 모델: 초기 무료 → DAU 1만 이상 확보 후 맥락형 광고 도입

## 2. 기술 스택
- 프론트엔드: React Native (iOS/Android 동시 대응)
- 백엔드: Supabase (PostgreSQL + Realtime + Auth + Storage)
- 지도: 카카오맵 SDK (국내) 또는 Google Maps SDK
- 위치: 실시간 위치 동기화는 Supabase Realtime 채널 사용
- 푸시 알림: FCM
- GPS 트래킹: 백그라운드 위치 권한 처리 필수
- 배터리 최적화: 러닝 중 고빈도(1초), 대기 중 저빈도(30초~1분)

## 3. MVP 기능 명세
### 3.1 회원가입 및 프로필
전화번호 인증(SMS OTP) 필수. 프로필: 닉네임, 성별, 연령대, 평균 페이스, 사진. 러닝 기록 연동 시 '인증 러너' 배지.

### 3.2 실시간 매칭 (핵심)
3탭 이내 매칭 요청. 지도에 '지금 뛸 준비 된 러너' 마커. 입력값: 위치(자동)/러닝 목적(조깅·템포런·LSD·인터벌)/목표 페이스/목표 거리·시간.
알고리즘 우선순위: ①페이스 호환(30초/km 이내) ②목적 일치 ③근접성(2km 우선). 대기 0명 → 예약 매칭 제안. 성사 시 채팅방 생성 + 푸시.

### 3.3 안전 보장 시스템 (매칭과 동등한 우선순위)
2단계 프로필 인증 / 공개 장소 만남 지점 자동 추천 / 긴급 버튼 1탭 보호자 SMS / 여성 전용 매칭 / 상호 5점 평가·신고 / 노쇼 2회 패널티 / 첫 매칭 안전 수칙 모달.

### 3.4 인앱 채팅
매칭 상대와만. 개인정보 패턴 자동 마스킹. 러닝 종료 24시간 후 자동 비활성화.

## 4~5. 2·3차 범위
GPS 트래킹, 글랜서블 러닝 UI, 부상 예방 알림, 공유 카드(바이럴 루프), 함께 뛴 횟수 통계 → 크루, 리워드, 맥락형 광고.

## 6. UX/UI 원칙
3탭 이내·고대비·한 손 조작·48dp 터치 타겟·빈 상태 설계·다크모드.

## 7. DB 스키마 / 8. 우선순위 / 9. 코딩 규칙
users, match_requests, matches, chats, runs, ratings, emergency_contacts.
검증 순서: 실시간 위치+매칭 → GPS/배터리 → 안전 → 채팅 → 트래킹.
TypeScript strict, features/ 폴더 구조, 근사 좌표 노출 원칙, 위치정보법 준수.

---

## 구현 현황

| 지시서 항목 | 상태 | 구현 위치 |
|---|---|---|
| §2 Supabase 백엔드 | ✅ 완료 | `supabase/migrations/` (스키마+RLS+알고리즘) |
| §3.1 전화 인증·프로필 | ✅ 스키마/정책 완료, 대시보드 연결만 필요 | `0002_schema.sql` profiles, [USER_TASKS](./USER_TASKS.md) §2 |
| §3.2 매칭 알고리즘 (페이스→목적→근접) | ✅ 완료 | `0004_functions.sql` `find_match`/`request_match` |
| §3.2 근사 좌표 마커 | ✅ 완료 (150m 그리드) | `nearby_runners`, `snap_to_grid` |
| §3.2 예약 매칭 전환 | ✅ 서버 지원 (`p_scheduled_at`) | `request_match` |
| §3.2 매칭 푸시 | ✅ Edge Function | `functions/notify-match/` |
| §3.3 만남 지점 추천 (공개 장소) | ✅ 완료 | `recommend_meeting_point` + `public_places` |
| §3.3 긴급 SMS | ✅ Edge Function (공급자 키만 필요) | `functions/emergency-alert/` |
| §3.3 여성 전용 매칭 | ✅ 완료 | `female_only_ok` |
| §3.3 평가·신고·노쇼 패널티 | ✅ 완료 (트리거+RPC) | `apply_rating`, `report_no_show` |
| §3.3 첫 매칭 안전 수칙 모달 | ✅ 완료 | `apps/mobile/src/features/safety/` |
| §3.4 채팅 + PII 마스킹 + 24h 만료 | ✅ DB 완료 (UI는 2차) | `chats` + `mask_pii` + RLS |
| §3.2/§9 즉흥 합류 프로토타입 (기술 리스크 검증, §8-1) | ✅ 동작 (테스트 11개) | `server/` + `apps/mobile/` 데모 모드 |
| 다국어 (한/영) | ✅ 완료 | `apps/mobile/src/i18n/` |
| §4 GPS 트래킹·공유 카드 | 🔜 2차 (스키마 준비됨: `runs`) | — |
| §5 크루·리워드·광고 | 🔜 3차 | — |
| 지도 SDK (카카오/구글) | 🔜 키 필요 — 현재 레이더 뷰로 대체 | [USER_TASKS](./USER_TASKS.md) §4 |
