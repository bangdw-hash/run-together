-- Run Together / RunMatch — core schema (work order §7, extended).
-- All tables hang off auth.users; phone OTP signup is enforced by Supabase Auth.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.gender as enum ('female', 'male', 'other');
create type public.age_group as enum ('10s', '20s', '30s', '40s', '50s', '60s+');
create type public.run_purpose as enum ('jog', 'tempo', 'lsd', 'interval');
create type public.request_status as enum ('waiting', 'matched', 'cancelled', 'expired');
create type public.match_status as enum ('confirmed', 'meeting', 'running', 'finished', 'cancelled', 'no_show');

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users; phone lives in auth.users.phone)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  nickname        text not null check (char_length(nickname) between 2 and 20),
  gender          public.gender not null,
  age_group       public.age_group not null,
  avg_pace_sec    integer not null check (avg_pace_sec between 150 and 900), -- sec/km
  photo_url       text,
  locale          text not null default 'ko' check (locale in ('ko', 'en')),
  units           text not null default 'km' check (units in ('km', 'mi')),
  verified_runner boolean not null default false,  -- set after run-history verification
  female_only     boolean not null default false,  -- women-only matching filter (§3.3)
  rating          numeric(3, 2) not null default 5.00 check (rating between 0 and 5),
  rating_count    integer not null default 0,
  no_show_count   integer not null default 0,
  suspended_until timestamptz,                     -- no-show / report penalty window
  created_at      timestamptz not null default now()
);

create unique index profiles_nickname_key on public.profiles (lower(nickname));

-- ---------------------------------------------------------------------------
-- Match requests — "I'm ready to run NOW"
-- ---------------------------------------------------------------------------
create table public.match_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  loc              geography(point, 4326) not null,   -- precise; never exposed raw (RLS)
  purpose          public.run_purpose not null,
  target_pace_sec  integer not null check (target_pace_sec between 150 and 900),
  target_km        numeric(4, 1),                     -- one of distance / duration
  target_min       integer,
  scheduled_at     timestamptz,                       -- null = right now; set = 예약 매칭
  status           public.request_status not null default 'waiting',
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '30 minutes',
  constraint one_goal check (target_km is not null or target_min is not null)
);

create index match_requests_geo_idx on public.match_requests using gist (loc);
create index match_requests_waiting_idx on public.match_requests (status, expires_at)
  where status = 'waiting';
-- One live request per user.
create unique index match_requests_one_live on public.match_requests (user_id)
  where status = 'waiting';

-- ---------------------------------------------------------------------------
-- Public meeting places (park entrances, subway exits — §3.3)
-- ---------------------------------------------------------------------------
create table public.public_places (
  id      bigint generated always as identity primary key,
  name_ko text not null,
  name_en text not null,
  kind    text not null check (kind in ('park_entrance', 'subway_exit', 'landmark', 'track')),
  loc     geography(point, 4326) not null
);

create index public_places_geo_idx on public.public_places using gist (loc);

-- ---------------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------------
create table public.matches (
  id                 uuid primary key default gen_random_uuid(),
  request_a          uuid not null references public.match_requests (id),
  request_b          uuid not null references public.match_requests (id),
  user_a             uuid not null references public.profiles (id),
  user_b             uuid not null references public.profiles (id),
  meeting_place_id   bigint references public.public_places (id),
  meeting_point      geography(point, 4326) not null,
  meeting_point_name text not null,
  status             public.match_status not null default 'confirmed',
  created_at         timestamptz not null default now(),
  finished_at        timestamptz,
  constraint distinct_users check (user_a <> user_b)
);

create index matches_user_a_idx on public.matches (user_a);
create index matches_user_b_idx on public.matches (user_b);

-- ---------------------------------------------------------------------------
-- In-app chat (only between matched users; PII auto-masked by trigger)
-- ---------------------------------------------------------------------------
create table public.chats (
  id         bigint generated always as identity primary key,
  match_id   uuid not null references public.matches (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id),
  message    text not null check (char_length(message) <= 1000),
  created_at timestamptz not null default now()
);

create index chats_match_idx on public.chats (match_id, created_at);

-- ---------------------------------------------------------------------------
-- Run records (phase 2 — schema ready)
-- ---------------------------------------------------------------------------
create table public.runs (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid references public.matches (id),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  distance_m    integer not null default 0,
  duration_sec  integer not null default 0,
  avg_pace_sec  integer,
  route_geojson jsonb,        -- opt-in: stored only when the user chooses to keep the track
  created_at    timestamptz not null default now()
);

create index runs_user_idx on public.runs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Mutual post-run ratings + reports (§3.3)
-- ---------------------------------------------------------------------------
create table public.ratings (
  id          bigint generated always as identity primary key,
  match_id    uuid not null references public.matches (id),
  rater_id    uuid not null references public.profiles (id),
  rated_id    uuid not null references public.profiles (id),
  score       integer not null check (score between 1 and 5),
  report_flag boolean not null default false,
  comment     text check (char_length(comment) <= 500),
  created_at  timestamptz not null default now(),
  constraint no_self_rating check (rater_id <> rated_id),
  constraint one_rating_per_match unique (match_id, rater_id)
);

-- ---------------------------------------------------------------------------
-- Blocks — blocked pairs are never matched or shown again
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ---------------------------------------------------------------------------
-- Emergency contacts (§3.3 — 긴급 위치 공유 대상)
-- ---------------------------------------------------------------------------
create table public.emergency_contacts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  contact_name  text not null,
  contact_phone text not null,
  created_at    timestamptz not null default now()
);

create index emergency_contacts_user_idx on public.emergency_contacts (user_id);

-- Emergency alert log (what was sent, when, from where)
create table public.emergency_alerts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  loc        geography(point, 4326) not null,
  match_id   uuid references public.matches (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FCM device tokens
-- ---------------------------------------------------------------------------
create table public.devices (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  fcm_token  text not null,
  platform   text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  primary key (user_id, fcm_token)
);
