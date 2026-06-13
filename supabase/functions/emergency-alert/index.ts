// Edge Function: 긴급 위치 공유 (work order §3.3).
// Client calls this with the runner's current coordinates; it logs the alert
// via the trigger_emergency RPC and sends an SMS with a live map link to all
// registered emergency contacts.
//
// Required secrets (supabase secrets set ...):
//   SMS_PROVIDER_URL, SMS_PROVIDER_KEY  — e.g. Twilio / NHN Cloud / Solapi
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { lat, lng, matchId } = await req.json();
  const { data: contacts, error } = await supabase.rpc('trigger_emergency', {
    p_lat: lat,
    p_lng: lng,
    p_match_id: matchId ?? null,
  });
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const mapLink = `https://maps.google.com/?q=${lat},${lng}`;
  const results = await Promise.allSettled(
    (contacts ?? []).map((c: { contact_phone: string; nickname: string }) =>
      fetch(Deno.env.get('SMS_PROVIDER_URL')!, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SMS_PROVIDER_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: c.contact_phone,
          text: `[RunMatch 긴급] ${c.nickname} 님의 현재 위치: ${mapLink}`,
        }),
      }),
    ),
  );

  return Response.json({
    sent: results.filter((r) => r.status === 'fulfilled').length,
    total: contacts?.length ?? 0,
  });
});
