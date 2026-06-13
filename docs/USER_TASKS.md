# 직접 하셔야 할 일 (개발자/운영자 체크리스트)

코드·스키마·알고리즘은 이 저장소에 모두 구현되어 있습니다.
아래 항목은 **계정·키·계약·법적 절차**라서 직접 진행하셔야 합니다.
순서대로 진행하면 됩니다 — 1~3번만 끝나면 실기기에서 전체 흐름을 돌려볼 수 있습니다.

## 1. 지금 바로 (무료, ~30분)

- [ ] **Node 22+ 설치** 후 `npm install` → `npm test`로 동작 확인
- [ ] 휴대폰에 **Expo Go** 설치 → `npm run mobile` → QR 스캔
  - 서버/키 없이 **데모 모드**로 매칭~합류 전체 흐름 체험 가능
- [ ] 같은 Wi-Fi에서 `npm run server` 실행 → 앱 설정에 `http://<내IP>:4000` 입력
  → 휴대폰 2대로 **실제 상호 매칭** 테스트

## 2. Supabase (프로덕션 백엔드, 무료 티어로 시작)

- [ ] [supabase.com](https://supabase.com) 프로젝트 생성 → `Project URL` / `anon key` 확보
- [ ] `npx supabase link --project-ref <REF>` → `npx supabase db push` (스키마·매칭 알고리즘 적용)
- [ ] **Auth → Phone 활성화** + SMS 공급자 연결 ← 전화번호 OTP 가입(§3.1)에 필수
  - 한국 발송: Solapi / NHN Cloud, 글로벌: Twilio (발신번호 사전등록은 한국 법정 의무)
- [ ] Database Webhook 설정: `matches` INSERT → `notify-match` Edge Function
- [ ] `npx supabase secrets set`으로 SMS·FCM 키 등록 (supabase/README.md 참고)

## 3. 푸시 알림 (FCM)

- [ ] Firebase 프로젝트 생성 → 서비스 계정 JSON 발급 (`FCM_SERVICE_ACCOUNT`)
- [ ] iOS용 APNs 인증 키(.p8) 발급 → Firebase에 업로드 (Apple 개발자 계정 필요)

## 4. 지도 SDK (2차 — 현재 MVP는 키 없는 레이더 뷰로 동작)

- [ ] 카카오 디벨로퍼스 앱 생성 → 네이티브 앱 키 (국내 지도)
- [ ] Google Maps Platform API 키 (글로벌)

## 5. 스토어 출시

- [ ] Apple Developer Program 등록 (연 $99) / Google Play Console (1회 $25)
- [ ] [expo.dev](https://expo.dev) 계정 → `eas build`로 스토어 빌드
- [ ] 앱 아이콘·스플래시·스크린샷 등 디자인 자산
- [ ] iOS 백그라운드 위치(Always) 권한 사용 사유서 — 심사 시 요구됨

## 6. 법적 절차 (한국 출시 필수 — §9 개인정보 처리)

- [ ] **위치정보사업/위치기반서비스사업 신고** (방송통신위원회, 위치정보법) — 출시 전 완료 필수
- [ ] 개인정보처리방침·이용약관·위치정보 이용약관 작성 (변호사 검토 권장)
- [ ] 만 14세 미만 가입 차단 정책 확정
- [ ] 긴급 SMS 발신번호 사전등록

## 7. 운영 데이터

- [ ] `public_places` 테이블에 서비스 지역의 공개 만남 장소 적재
  (현재 서울 한강공원·지하철역 샘플 8곳 — 공공데이터포털 POI로 확장 권장)

---

비용 요약: 1~2번 0원 / 3번 0원 / 5번 약 ₩16만(첫해) / SMS는 건당 과금.
DAU 1만 전까지는 Supabase 무료~Pro($25/월) 범위로 운영 가능합니다.
