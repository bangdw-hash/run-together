/**
 * Typed wrappers over the Supabase backend RPCs (supabase/migrations/0004).
 * Every call degrades gracefully to a simulated result when Supabase isn't
 * configured, so the demo experience stays intact.
 */
import type { LatLng } from '@run-together/shared';
import { supabase } from './supabase';

export type RunPurpose = 'jog' | 'tempo' | 'lsd' | 'interval';
export type Gender = 'female' | 'male' | 'other';
export type AgeGroup = '10s' | '20s' | '30s' | '40s' | '50s' | '60s+';

export interface ProfileInput {
  nickname: string;
  gender: Gender;
  ageGroup: AgeGroup;
  avgPaceSec: number;
  locale: 'ko' | 'en';
  femaleOnly: boolean;
}

export const backendConfigured = supabase !== null;

// ---- auth ------------------------------------------------------------------

export async function sendOtp(phone: string): Promise<{ error?: string }> {
  if (!supabase) return {};
  const { error } = await supabase.auth.signInWithOtp({ phone });
  return error ? { error: error.message } : {};
}

export async function verifyOtp(phone: string, token: string): Promise<{ error?: string }> {
  if (!supabase) return {};
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  return error ? { error: error.message } : {};
}

// ---- profile ---------------------------------------------------------------

export async function getMyProfile(): Promise<{ nickname: string } | null> {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', auth.user.id)
    .maybeSingle();
  return data;
}

export async function upsertProfile(input: ProfileInput): Promise<{ error?: string }> {
  if (!supabase) return {};
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: 'NOT_SIGNED_IN' };
  const { error } = await supabase.from('profiles').upsert({
    id: auth.user.id,
    nickname: input.nickname,
    gender: input.gender,
    age_group: input.ageGroup,
    avg_pace_sec: input.avgPaceSec,
    locale: input.locale,
    female_only: input.femaleOnly,
  });
  return error ? { error: error.message } : {};
}

// ---- matching (production flow; the in-run radar uses the gateway) ---------

export async function requestMatch(params: {
  loc: LatLng;
  purpose: RunPurpose;
  targetPaceSec: number;
  targetKm?: number;
  targetMin?: number;
  scheduledAt?: Date;
}): Promise<{ requestId?: string; matchId?: string | null; error?: string }> {
  if (!supabase) return { requestId: 'demo', matchId: null };
  const { data, error } = await supabase.rpc('request_match', {
    p_lat: params.loc.lat,
    p_lng: params.loc.lng,
    p_purpose: params.purpose,
    p_target_pace_sec: params.targetPaceSec,
    p_target_km: params.targetKm ?? null,
    p_target_min: params.targetMin ?? null,
    p_scheduled_at: params.scheduledAt?.toISOString() ?? null,
  });
  if (error) return { error: error.message };
  return { requestId: data?.[0]?.request_id, matchId: data?.[0]?.match_id ?? null };
}

export async function nearbyRunners(radiusM = 3000) {
  if (!supabase) return [];
  const { data } = await supabase.rpc('nearby_runners', { radius_m: radiusM });
  return data ?? [];
}

export async function finishMatch(matchId: string): Promise<void> {
  await supabase?.rpc('finish_match', { p_match_id: matchId });
}

export async function rateMatch(params: {
  matchId: string;
  ratedId: string;
  score: number;
  reportFlag?: boolean;
  comment?: string;
}): Promise<void> {
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from('ratings').insert({
    match_id: params.matchId,
    rater_id: auth.user.id,
    rated_id: params.ratedId,
    score: params.score,
    report_flag: params.reportFlag ?? false,
    comment: params.comment,
  });
}

// ---- safety ----------------------------------------------------------------

export async function triggerEmergency(
  loc: LatLng,
  matchId?: string,
): Promise<{ sent: number; simulated: boolean }> {
  if (!supabase) return { sent: 0, simulated: true };
  const { data, error } = await supabase.functions.invoke('emergency-alert', {
    body: { lat: loc.lat, lng: loc.lng, matchId },
  });
  if (error) return { sent: 0, simulated: false };
  return { sent: data?.sent ?? 0, simulated: false };
}
