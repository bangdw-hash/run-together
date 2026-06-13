// Edge Function: 매칭 성사 푸시 알림 (work order §3.2).
// Invoked by a Database Webhook on INSERT into public.matches.
// Sends an FCM message to both members' registered devices.
//
// Required secrets: FCM_SERVICE_ACCOUNT (JSON), FCM_PROJECT_ID
import { createClient } from 'jsr:@supabase/supabase-js@2';

async function fcmAccessToken(): Promise<string> {
  // Exchange the service-account JWT for an OAuth token (google-auth flow).
  const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT')!);
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = btoa(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\n/g, '')), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const jwt = `${header}.${claims}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  return (await res.json()).access_token;
}

Deno.serve(async (req) => {
  const { record } = await req.json(); // database webhook payload (new match row)
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: devices } = await admin
    .from('devices')
    .select('fcm_token, user_id, profiles!inner(locale)')
    .in('user_id', [record.user_a, record.user_b]);
  if (!devices?.length) return Response.json({ sent: 0 });

  const token = await fcmAccessToken();
  const projectId = Deno.env.get('FCM_PROJECT_ID');
  let sent = 0;
  for (const d of devices) {
    const ko = (d as { profiles?: { locale?: string } }).profiles?.locale !== 'en';
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: d.fcm_token,
            notification: {
              title: ko ? '매칭 성사! 🏃' : 'Matched! 🏃',
              body: ko
                ? `만남 지점: ${record.meeting_point_name}`
                : `Meeting point: ${record.meeting_point_name}`,
            },
            data: { matchId: record.id },
          },
        }),
      },
    );
    if (res.ok) sent++;
  }
  return Response.json({ sent });
});
