/**
 * PII masking for chat (work order §3.4). Mirrors the database trigger in
 * supabase/migrations/0004_functions.sql so demo mode and optimistic UI
 * behave exactly like the server.
 */
const KR_MOBILE = /01[016789][ .-]?\d{3,4}[ .-]?\d{4}/g;
const INTL_PHONE = /\+?\d{1,3}[ .-]?\(?\d{2,4}\)?[ .-]?\d{3,4}[ .-]?\d{4}/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function maskPii(text: string): string {
  return text
    .replace(KR_MOBILE, '***-****-****')
    .replace(INTL_PHONE, '***-****-****')
    .replace(EMAIL, '***@***');
}
