# Supabase 백엔드 (RunMatch)

작업지시서 §2·§7 기준의 프로덕션 백엔드. PostgreSQL + PostGIS + Realtime + Auth + Edge Functions.

## 구성

| 경로 | 내용 |
|---|---|
| `migrations/0001_extensions.sql` | PostGIS, pg_cron |
| `migrations/0002_schema.sql` | 전체 스키마 (profiles, match_requests, matches, chats, runs, ratings, blocks, emergency_contacts, devices, public_places) |
| `migrations/0003_rls.sql` | RLS 정책 — 정확 좌표는 타인에게 절대 직접 노출되지 않음 |
| `migrations/0004_functions.sql` | 매칭 알고리즘(`request_match`/`find_match`), 근접 탐색(`nearby_runners`, 150m 그리드 스냅), 만남 지점 추천, 채팅 PII 마스킹 트리거, 평점/신고/노쇼 패널티, 긴급 알림, 만료 크론 |
| `seed.sql` | 공개 만남 장소 샘플 (서울 한강공원·지하철역 + 해외 예시) |
| `functions/emergency-alert/` | 긴급 위치 SMS Edge Function |
| `functions/notify-match/` | 매칭 성사 FCM 푸시 Edge Function (matches INSERT 웹훅) |

## 로컬 실행

```bash
npx supabase init        # 최초 1회 (config.toml 생성)
npx supabase start       # 로컬 스택 기동
npx supabase db reset    # migrations + seed 적용
```

## 배포

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
npx supabase functions deploy emergency-alert notify-match
npx supabase secrets set SMS_PROVIDER_URL=... SMS_PROVIDER_KEY=... \
  FCM_SERVICE_ACCOUNT='<service-account.json>' FCM_PROJECT_ID=...
```

추가로 대시보드에서:
1. **Auth → Phone** 활성화 + SMS 공급자(Twilio/Messagebird 등) 연결 — 전화번호 OTP 가입(§3.1)
2. **Database → Webhooks**: `public.matches` INSERT → `notify-match` 함수 호출
3. **Realtime**: `chats`, `matches`는 마이그레이션에서 publication에 추가됨.
   러닝 중 실시간 위치 동기화는 테이블 없이 **Realtime Broadcast 채널**(`match:{matchId}`) 사용 —
   위치를 DB에 저장하지 않아 개인정보 노출 면적을 최소화.

## 클라이언트 호출 흐름 (3탭 매칭)

```ts
// ① 목적/페이스 선택 → ② 거리 선택 → ③ 시작 버튼
const { data } = await supabase.rpc('request_match', {
  p_lat: lat, p_lng: lng,
  p_purpose: 'jog', p_target_pace_sec: 360, p_target_km: 5,
});
// data[0].match_id 가 null이면 대기 — matches INSERT를 Realtime으로 구독해 성사 통지 수신
// 대기 인원 0명 UX: 30초 내 미성사 시 p_scheduled_at으로 예약 매칭 제안(§3.2)

const { data: runners } = await supabase.rpc('nearby_runners', { radius_m: 3000 });
// → 150m 근사 좌표만 반환됨 (지도 마커용)
```
