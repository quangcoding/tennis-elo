-- Run this once in the Supabase SQL Editor before switching the app to Supabase.
-- Safe to re-run (uses IF NOT EXISTS everywhere).

-- 1. Seasons table (new)
create table if not exists seasons (
  _id text primary key,
  name text not null,
  start_date date not null,
  end_date date not null,
  description text,
  created_at timestamptz not null default now()
);

-- 2. Sessions: link to a season
alter table sessions add column if not exists season_id text references seasons(_id);

-- 3. Matches table (create if it doesn't exist yet)
create table if not exists matches (
  id text primary key,
  winner_ids jsonb not null,
  winner_names jsonb not null,
  loser_ids jsonb not null,
  loser_names jsonb not null,
  score text not null,
  elo_change numeric not null,
  played_at timestamptz not null,
  winner_id text,
  winner_name text,
  loser_id text,
  loser_name text
);

-- 4. Matches: link to a session (N matches -> 1 session)
alter table matches add column if not exists session_id text references sessions(_id);

-- 5. RLS: mirror whatever policy already exists on "players"/"sessions" onto
--    "seasons" and "matches" (enable RLS + allow the anon role to
--    select/insert/update/delete), e.g.:
-- alter table seasons enable row level security;
-- create policy "allow all seasons" on seasons for all using (true) with check (true);
-- alter table matches enable row level security;
-- create policy "allow all matches" on matches for all using (true) with check (true);
