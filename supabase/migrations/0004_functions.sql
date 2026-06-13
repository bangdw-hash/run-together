-- Core server logic: matching algorithm, discovery with privacy snapping,
-- meeting-point recommendation, PII masking, ratings/no-show penalties,
-- emergency alerts, scheduled cleanup. (Work order §3.2, §3.3, §3.4, §8.)

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Snap a point to a ~150 m grid: what other users are allowed to see.
create or replace function public.snap_to_grid(p geography)
returns geography language sql immutable as $$
  select st_setsrid(st_makepoint(
    round(st_x(p::geometry) / 0.0017) * 0.0017,
    round(st_y(p::geometry) / 0.00135) * 0.00135
  ), 4326)::geography
$$;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- Women-only compatibility (§3.3): if either side enabled the filter,
-- both runners must be female.
create or replace function public.female_only_ok(pa public.profiles, pb public.profiles)
returns boolean language sql immutable as $$
  select case
    when pa.female_only or pb.female_only
      then pa.gender = 'female' and pb.gender = 'female'
    else true
  end
$$;

-- ---------------------------------------------------------------------------
-- Discovery: live waiting runners near me, approximate locations only
-- ---------------------------------------------------------------------------
create or replace function public.nearby_runners(radius_m integer default 3000)
returns table (
  request_id uuid,
  nickname text,
  verified_runner boolean,
  rating numeric,
  purpose public.run_purpose,
  target_pace_sec integer,
  approx_lat double precision,
  approx_lng double precision,
  distance_m double precision,
  waiting_since timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  my_loc geography;
begin
  select mr.loc into my_loc
  from match_requests mr
  where mr.user_id = auth.uid() and mr.status = 'waiting';
  if my_loc is null then
    raise exception 'NO_ACTIVE_REQUEST';
  end if;

  return query
  select
    mr.id,
    p.nickname,
    p.verified_runner,
    p.rating,
    mr.purpose,
    mr.target_pace_sec,
    st_y(snap_to_grid(mr.loc)::geometry),
    st_x(snap_to_grid(mr.loc)::geometry),
    st_distance(my_loc, snap_to_grid(mr.loc)),
    mr.created_at
  from match_requests mr
  join profiles p on p.id = mr.user_id
  join profiles me on me.id = auth.uid()
  where mr.user_id <> auth.uid()
    and mr.status = 'waiting'
    and mr.expires_at > now()
    and (mr.scheduled_at is null)
    and st_dwithin(my_loc, mr.loc, radius_m)
    and not is_blocked(auth.uid(), mr.user_id)
    and female_only_ok(me, p)
    and (p.suspended_until is null or p.suspended_until < now())
  order by st_distance(my_loc, snap_to_grid(mr.loc));
end $$;

-- ---------------------------------------------------------------------------
-- Meeting point: public place nearest to the two runners' midpoint (§3.3).
-- Falls back to the raw midpoint when no public place is within 1 km.
-- ---------------------------------------------------------------------------
create or replace function public.recommend_meeting_point(
  loc_a geography, loc_b geography,
  out place_id bigint, out point geography, out name_ko text, out name_en text
)
language plpgsql stable security definer set search_path = public as $$
declare
  midpoint geography;
begin
  midpoint := st_centroid(st_collect(loc_a::geometry, loc_b::geometry))::geography;
  select pp.id, pp.loc, pp.name_ko, pp.name_en
    into place_id, point, name_ko, name_en
  from public_places pp
  where st_dwithin(pp.loc, midpoint, 1000)
  order by st_distance(pp.loc, midpoint)
  limit 1;
  if place_id is null then
    point := midpoint;
    name_ko := '중간 지점';
    name_en := 'Midpoint';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Matching algorithm (§3.2):
--   hard filter : pace difference ≤ 30 s/km, not blocked, women-only compat
--   priority    : ① pace closeness ② same purpose ③ proximity (≤2 km first)
-- Row locking (FOR UPDATE SKIP LOCKED) makes concurrent matching race-safe.
-- ---------------------------------------------------------------------------
create or replace function public.find_match(p_request_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  req match_requests%rowtype;
  my_profile profiles%rowtype;
  cand match_requests%rowtype;
  mp record;
  new_match_id uuid;
begin
  select * into req from match_requests
  where id = p_request_id and user_id = auth.uid() and status = 'waiting'
  for update skip locked;
  if not found then
    return null;
  end if;
  select * into my_profile from profiles where id = req.user_id;

  select mr.* into cand
  from match_requests mr
  join profiles p on p.id = mr.user_id
  where mr.id <> req.id
    and mr.user_id <> req.user_id
    and mr.status = 'waiting'
    and mr.expires_at > now()
    and mr.scheduled_at is not distinct from null
    and abs(mr.target_pace_sec - req.target_pace_sec) <= 30          -- ① hard pace gate
    and st_dwithin(req.loc, mr.loc, 5000)
    and not is_blocked(req.user_id, mr.user_id)
    and female_only_ok(my_profile, p)
    and (p.suspended_until is null or p.suspended_until < now())
  order by
    (st_distance(req.loc, mr.loc) <= 2000) desc,                     -- ③ ≤2 km first
    (mr.purpose = req.purpose) desc,                                 -- ② purpose match
    abs(mr.target_pace_sec - req.target_pace_sec),
    st_distance(req.loc, mr.loc)
  limit 1
  for update skip locked;

  if cand.id is null then
    return null;
  end if;

  select * into mp from recommend_meeting_point(req.loc, cand.loc);

  insert into matches (request_a, request_b, user_a, user_b,
                       meeting_place_id, meeting_point, meeting_point_name)
  values (req.id, cand.id, req.user_id, cand.user_id,
          mp.place_id, mp.point,
          case when my_profile.locale = 'en' then mp.name_en else mp.name_ko end)
  returning id into new_match_id;

  update match_requests set status = 'matched' where id in (req.id, cand.id);
  return new_match_id;
end $$;

-- ---------------------------------------------------------------------------
-- One-shot entry point for the "3 taps to match" flow: create my request and
-- immediately try to match it. Returns the request id and (maybe) a match id.
-- ---------------------------------------------------------------------------
create or replace function public.request_match(
  p_lat double precision,
  p_lng double precision,
  p_purpose public.run_purpose,
  p_target_pace_sec integer,
  p_target_km numeric default null,
  p_target_min integer default null,
  p_scheduled_at timestamptz default null
)
returns table (request_id uuid, match_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  me profiles%rowtype;
  rid uuid;
  mid uuid;
begin
  select * into me from profiles where id = auth.uid();
  if not found then
    raise exception 'NO_PROFILE';
  end if;
  if me.suspended_until is not null and me.suspended_until > now() then
    raise exception 'SUSPENDED_UNTIL %', me.suspended_until;
  end if;

  -- Replace any previous live request.
  update match_requests set status = 'cancelled'
  where user_id = auth.uid() and status = 'waiting';

  insert into match_requests (user_id, loc, purpose, target_pace_sec,
                              target_km, target_min, scheduled_at)
  values (auth.uid(),
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          p_purpose, p_target_pace_sec, p_target_km, p_target_min, p_scheduled_at)
  returning id into rid;

  if p_scheduled_at is null then
    mid := find_match(rid);
  end if;
  return query select rid, mid;
end $$;

-- ---------------------------------------------------------------------------
-- Post-run flow: finish, rate, no-show, block (§3.3)
-- ---------------------------------------------------------------------------
create or replace function public.finish_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update matches set status = 'finished', finished_at = now()
  where id = p_match_id and auth.uid() in (user_a, user_b)
    and status in ('confirmed', 'meeting', 'running');
end $$;

-- Keep profiles.rating in sync; suspend on repeated reports.
create or replace function public.apply_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  report_count integer;
begin
  update profiles
  set rating = ((rating * rating_count) + new.score) / (rating_count + 1),
      rating_count = rating_count + 1
  where id = new.rated_id;

  if new.report_flag then
    select count(*) into report_count
    from ratings where rated_id = new.rated_id and report_flag;
    if report_count >= 3 then
      update profiles set suspended_until = now() + interval '7 days'
      where id = new.rated_id;
    end if;
  end if;
  return new;
end $$;

create trigger ratings_apply after insert on public.ratings
for each row execute function public.apply_rating();

-- No-show: reported by the other member; 2 strikes → 7-day suspension.
create or replace function public.report_no_show(p_match_id uuid, p_no_show_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
  strikes integer;
begin
  select * into m from matches where id = p_match_id;
  if not found or auth.uid() not in (m.user_a, m.user_b)
     or p_no_show_user not in (m.user_a, m.user_b) or p_no_show_user = auth.uid() then
    raise exception 'INVALID_NO_SHOW_REPORT';
  end if;

  update matches set status = 'no_show' where id = p_match_id;
  update profiles set no_show_count = no_show_count + 1
  where id = p_no_show_user
  returning no_show_count into strikes;

  if strikes >= 2 then
    update profiles set suspended_until = now() + interval '7 days'
    where id = p_no_show_user;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Chat PII masking (§3.4): phone numbers and emails are masked on write.
-- ---------------------------------------------------------------------------
create or replace function public.mask_pii()
returns trigger language plpgsql as $$
begin
  new.message := regexp_replace(new.message,
    '01[016789][ .-]?\d{3,4}[ .-]?\d{4}', '***-****-****', 'g');        -- KR mobile
  new.message := regexp_replace(new.message,
    '\+?\d{1,3}[ .-]?\(?\d{2,4}\)?[ .-]?\d{3,4}[ .-]?\d{4}', '***-****-****', 'g');
  new.message := regexp_replace(new.message,
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '***@***', 'g');
  return new;
end $$;

create trigger chats_mask_pii before insert on public.chats
for each row execute function public.mask_pii();

-- ---------------------------------------------------------------------------
-- Emergency alert (§3.3): log + payload for the edge function that sends SMS.
-- ---------------------------------------------------------------------------
create or replace function public.trigger_emergency(
  p_lat double precision, p_lng double precision, p_match_id uuid default null
)
returns table (contact_name text, contact_phone text, nickname text)
language plpgsql security definer set search_path = public as $$
begin
  insert into emergency_alerts (user_id, loc, match_id)
  values (auth.uid(),
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          p_match_id);
  return query
  select ec.contact_name, ec.contact_phone, p.nickname
  from emergency_contacts ec
  join profiles p on p.id = ec.user_id
  where ec.user_id = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Scheduled cleanup (pg_cron): expire stale requests every minute.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_requests()
returns void language sql security definer set search_path = public as $$
  update match_requests set status = 'expired'
  where status = 'waiting' and expires_at < now();
$$;

select cron.schedule('expire-stale-requests', '* * * * *',
                     $$select public.expire_stale_requests()$$);
