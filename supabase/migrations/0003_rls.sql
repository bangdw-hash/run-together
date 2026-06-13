-- Row Level Security: precise locations are NEVER directly readable by other
-- users — discovery goes through the security-definer RPCs in 0004, which
-- return grid-snapped coordinates only (work order §9).

alter table public.profiles           enable row level security;
alter table public.match_requests    enable row level security;
alter table public.public_places     enable row level security;
alter table public.matches           enable row level security;
alter table public.chats             enable row level security;
alter table public.runs              enable row level security;
alter table public.ratings           enable row level security;
alter table public.blocks            enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.emergency_alerts  enable row level security;
alter table public.devices           enable row level security;

-- profiles: everyone signed-in can read public profile cards; only the owner writes.
create policy profiles_read on public.profiles
  for select to authenticated using (true);
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (
    id = auth.uid()
    -- penalty/verification fields are managed by definer functions only
    and rating = (select p.rating from public.profiles p where p.id = auth.uid())
    and rating_count = (select p.rating_count from public.profiles p where p.id = auth.uid())
    and no_show_count = (select p.no_show_count from public.profiles p where p.id = auth.uid())
    and verified_runner = (select p.verified_runner from public.profiles p where p.id = auth.uid())
    and (suspended_until is not distinct from (select p.suspended_until from public.profiles p where p.id = auth.uid()))
  );

-- match_requests: owners only. Other users never see raw rows (→ RPC).
create policy match_requests_own on public.match_requests
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- public_places: readable by all signed-in users.
create policy public_places_read on public.public_places
  for select to authenticated using (true);

-- matches: visible to its two members; written only by definer functions.
create policy matches_members_read on public.matches
  for select to authenticated using (auth.uid() in (user_a, user_b));

-- chats: members of the match may read; insert allowed while the match is
-- active, or within 24 h after finishing (auto-deactivation, work order §3.4).
create policy chats_members_read on public.chats
  for select to authenticated using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and auth.uid() in (m.user_a, m.user_b)
    )
  );
create policy chats_members_insert on public.chats
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and auth.uid() in (m.user_a, m.user_b)
        and (
          m.status in ('confirmed', 'meeting', 'running')
          or (m.status = 'finished' and m.finished_at > now() - interval '24 hours')
        )
    )
  );

-- runs: owner only.
create policy runs_own on public.runs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ratings: a match member may rate the other member once; readable by the
-- rater and (score only, via app) the rated user.
create policy ratings_read on public.ratings
  for select to authenticated using (auth.uid() in (rater_id, rated_id));
create policy ratings_insert on public.ratings
  for insert to authenticated with check (
    rater_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and auth.uid() in (m.user_a, m.user_b)
        and rated_id in (m.user_a, m.user_b)
    )
  );

-- blocks / emergency contacts / devices: strictly own rows.
create policy blocks_own on public.blocks
  for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy emergency_contacts_own on public.emergency_contacts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy emergency_alerts_own on public.emergency_alerts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy devices_own on public.devices
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Realtime: matched pairs get chat + match-status changes pushed.
alter publication supabase_realtime add table public.chats;
alter publication supabase_realtime add table public.matches;
