-- LiftLeague — shared-core Postgres schema (Supabase)
-- Zero-regret data model: identical for both product directions.
-- Ranking/percentile logic lives in SQL window functions — the reason we chose
-- Postgres over Firebase.

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ---------- profiles (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  sex           text check (sex in ('male','female')),
  bodyweight_kg numeric(5,2),
  age_years     int,
  training_started_at date,          -- drives trainingAgeWeeks
  home_gym_id   uuid,                 -- set below via FK after gyms exists
  created_at    timestamptz not null default now()
);

-- ---------- gyms (for the "same gym" competition layer) ----------
create table if not exists public.gyms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  join_code  text unique not null,   -- share a gym via a short code
  geo_lat    numeric(9,6),
  geo_lng    numeric(9,6),
  created_at timestamptz not null default now()
);
alter table public.profiles
  drop constraint if exists profiles_home_gym_fk,
  add constraint profiles_home_gym_fk
  foreign key (home_gym_id) references public.gyms(id) on delete set null;

-- ---------- exercises (loaded from the free-exercise-db seed) ----------
create table if not exists public.exercises (
  id                text primary key,          -- e.g. 'Barbell_Squat'
  name              text not null,
  category          text,
  equipment         text,
  level             text,
  mechanic          text,
  force             text,
  loadable          boolean not null default false,
  primary_muscles   text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  images            text[] not null default '{}',
  instructions      text[] not null default '{}'
);

-- ---------- workouts + sets (the shared logging primitive) ----------
create table if not exists public.workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  performed_at timestamptz not null default now(),
  note         text,
  created_at   timestamptz not null default now()
);

create table if not exists public.workout_sets (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  exercise_id  text not null references public.exercises(id),
  weight_kg    numeric(6,2) not null default 0,
  reps         int not null check (reps >= 0),
  performed_at timestamptz not null default now(),
  -- estimated 1RM, averaged Epley+Brzycki, rep-window capped at 10 (kept in sync
  -- with src/scoring/e1rm.ts). Stored generated so leaderboards are pure SQL.
  e1rm numeric(7,2) generated always as (
    case
      when weight_kg <= 0 or reps <= 0 then 0
      when reps = 1 then weight_kg
      else (
        (weight_kg * (1 + least(reps,10)::numeric/30))
        + (weight_kg * (36.0 / (37 - least(reps,10))))
      ) / 2
    end
  ) stored
);
create index if not exists workout_sets_user_ex_idx on public.workout_sets(user_id, exercise_id, performed_at desc);

-- ---------- competitions / leagues ----------
create table if not exists public.leagues (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('friends','gym','level')),
  tier          text,                 -- bronze..diamond for 'level' leagues
  gym_id        uuid references public.gyms(id) on delete cascade,
  season_start  date not null,
  season_end    date not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  primary key (league_id, user_id)
);

-- computed once per scoring run (weekly), by the scoring service.
create table if not exists public.league_scores (
  league_id     uuid not null references public.leagues(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  season_start  date not null,
  score         numeric(8,2) not null,
  breakdown     jsonb not null default '{}',
  provider      text not null,        -- 'normalized-v1' | 'simple-xp-v1' (A/B attribution)
  computed_at   timestamptz not null default now(),
  primary key (league_id, user_id, season_start)
);

-- ---------- leaderboard view: ranking via window functions ----------
-- This is exactly why Postgres: rank + percentile in one query.
create or replace view public.v_league_leaderboard as
select
  ls.league_id,
  ls.season_start,
  ls.user_id,
  p.display_name,
  ls.score,
  ls.breakdown,
  rank()        over (partition by ls.league_id, ls.season_start order by ls.score desc) as position,
  percent_rank() over (partition by ls.league_id, ls.season_start order by ls.score)       as pct_beaten
from public.league_scores ls
join public.profiles p on p.id = ls.user_id;

-- ---------- Row-Level Security ----------
alter table public.profiles       enable row level security;
alter table public.workouts       enable row level security;
alter table public.workout_sets   enable row level security;
alter table public.league_members enable row level security;
alter table public.league_scores  enable row level security;

-- profiles: readable by anyone signed in (needed for leaderboards); writable by owner.
create policy if not exists profiles_read  on public.profiles for select using (auth.role() = 'authenticated');
create policy if not exists profiles_write on public.profiles for all    using (auth.uid() = id) with check (auth.uid() = id);

-- workouts/sets: private to the owner (aggregates surface only via scores).
create policy if not exists workouts_owner on public.workouts     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists sets_owner     on public.workout_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- league membership + scores: a member may read their league's rows.
create policy if not exists members_read on public.league_members for select using (
  exists (select 1 from public.league_members m where m.league_id = league_members.league_id and m.user_id = auth.uid())
);
create policy if not exists scores_read on public.league_scores for select using (
  exists (select 1 from public.league_members m where m.league_id = league_scores.league_id and m.user_id = auth.uid())
);
-- exercises are public reference data (read-only to clients); load via service role.
alter table public.exercises enable row level security;
create policy if not exists exercises_read on public.exercises for select using (true);
