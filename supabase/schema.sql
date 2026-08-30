-- Same Heart -- v1 schema (Star Day, Standing/XP, build log)
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- This is a record of what's actually live in your Supabase project --
-- if you change something in the dashboard, update this file to match.

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  birth_date date,                          -- powers the Star Day reveal
  frequency numeric(5,1),                   -- e.g. 612.4
  archetype text,                           -- e.g. "The Bloom Signal"
  designation text,                         -- e.g. "SH-0524-94"
  ship_skin text default 'cosmic-gold',     -- which Skin the Hub is themed with (see lib/skins.ts)
  companion_kind text default 'comet',      -- comet | moon | spark
  xp integer default 0,
  standing text default 'Listener',
  observatory_opt_in boolean default false,
  joined_at timestamptz default now()
);

create table if not exists log_entries (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  occurred_at timestamptz default now(),
  description text not null,
  xp_awarded integer default 0,
  category text default 'personal'          -- personal | humanitarian | system
);

alter table profiles enable row level security;
alter table log_entries enable row level security;

create policy "Users see their own profile" on profiles for select using (auth.uid() = id);
create policy "Users update their own profile" on profiles for update using (auth.uid() = id);

create policy "Users see their own log" on log_entries for select using (auth.uid() = profile_id);
create policy "Users insert their own log" on log_entries for insert with check (auth.uid() = profile_id);

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- One-time migration: ship_skin used to store a raw hex color (an idea
-- that never got built). It now stores a Skin key from lib/skins.ts
-- instead ("cosmic-gold" | "earth-tones" | "pastel-dream"). This updates
-- any existing rows still holding the old hex default so they land on a
-- real skin instead of an unrecognized value, and moves the column's
-- default forward for every new signup after this runs. Safe to run more
-- than once.
update profiles set ship_skin = 'cosmic-gold' where ship_skin is null or ship_skin = '#c9a15a';
alter table profiles alter column ship_skin set default 'cosmic-gold';

-- Identity layer, part 2: Path and a permanent Spark ID.
--
-- Path (guardian | seeker | weaver | flame, see lib/paths.ts) is a quick
-- personality read assigned right at arrival -- separate from Star Day,
-- which stays the deeper, permanent signal from a birth date.
--
-- Spark ID is a quiet, permanent member number, assigned automatically
-- the moment a profile row is created (anonymous or not) and never
-- reassigned -- the "Spark #00042" idea from the vision doc. Because the
-- default calls nextval(), running this ALTER for the first time also
-- backfills every existing row with its own number in the same pass.
-- Safe to run more than once.
create sequence if not exists spark_id_seq start 1;
alter table profiles add column if not exists spark_id bigint default nextval('spark_id_seq');
alter table profiles add column if not exists path_key text;
alter table profiles add column if not exists path_confidence numeric;
alter table profiles add column if not exists path_signals jsonb default '{}'::jsonb;
alter table profiles add column if not exists path_assigned_at timestamptz;

-- The Commons, v1: communities, discussions/questions, replies, and a
-- lightweight presence signal. This is the real functional core of a
-- much bigger vision (news pipeline, AI analysis, projects, Exchange
-- impact-tracking, a true 3D sphere) -- those are later phases, tracked
-- in README, not built here. Safe to run more than once.

alter table profiles add column if not exists last_seen timestamptz default now();

create table if not exists communities (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  name text not null,
  description text default '',
  accent text default '#c9576a',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists community_members (
  community_id uuid references communities(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (community_id, profile_id)
);

create table if not exists commons_threads (
  id uuid default gen_random_uuid() primary key,
  community_id uuid references communities(id) on delete set null,
  profile_id uuid references profiles(id) on delete cascade,
  kind text default 'discussion' check (kind in ('discussion', 'question')),
  title text not null,
  body text not null,
  created_at timestamptz default now(),
  last_activity_at timestamptz default now()
);

create table if not exists commons_replies (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references commons_threads(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

alter table communities enable row level security;
alter table community_members enable row level security;
alter table commons_threads enable row level security;
alter table commons_replies enable row level security;

drop policy if exists "Signed-in users see communities" on communities;
create policy "Signed-in users see communities" on communities for select using (auth.uid() is not null);
drop policy if exists "Signed-in users create communities" on communities;
create policy "Signed-in users create communities" on communities for insert with check (auth.uid() = created_by);

drop policy if exists "Signed-in users see memberships" on community_members;
create policy "Signed-in users see memberships" on community_members for select using (auth.uid() is not null);
drop policy if exists "Users join communities themselves" on community_members;
create policy "Users join communities themselves" on community_members for insert with check (auth.uid() = profile_id);

drop policy if exists "Signed-in users see threads" on commons_threads;
create policy "Signed-in users see threads" on commons_threads for select using (auth.uid() is not null);
drop policy if exists "Users start their own threads" on commons_threads;
create policy "Users start their own threads" on commons_threads for insert with check (auth.uid() = profile_id);
-- Deliberately no general "update" policy on commons_threads -- nobody
-- can edit a thread's title/body via the API. Bumping last_activity_at
-- when a reply comes in goes through the narrow function below instead,
-- which only ever touches that one column.

drop policy if exists "Signed-in users see replies" on commons_replies;
create policy "Signed-in users see replies" on commons_replies for select using (auth.uid() is not null);
drop policy if exists "Users write their own replies" on commons_replies;
create policy "Users write their own replies" on commons_replies for insert with check (auth.uid() = profile_id);

-- A narrow, public-safe slice of profiles (name, Spark ID, Path, Skin
-- only -- no birth date, frequency, XP, or Standing) so people can see
-- who posted what in the Commons. This works specifically because it's
-- created here, owned by the table owner: Postgres row-level security
-- is enforced based on the accessing role, and a plain view queried
-- through that owning role bypasses the strict "auth.uid() = id" policy
-- on the underlying profiles table -- while still only ever exposing
-- the columns explicitly listed below. profiles itself stays locked
-- down to "see your own row only."
create or replace view public_profiles as
  select id, display_name, spark_id, path_key, ship_skin
  from profiles;

grant select on public_profiles to authenticated;

-- Scoped RPC for the one legitimate cross-user write on commons_threads:
-- marking a thread as recently active when someone (anyone, not just the
-- original poster) replies to it. security definer so it can update the
-- row despite there being no general update policy; only ever touches
-- last_activity_at, never title/body/profile_id.
create or replace function public.bump_thread_activity(thread_id uuid)
returns void as $$
begin
  update commons_threads set last_activity_at = now() where id = thread_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.bump_thread_activity(uuid) to authenticated;

notify pgrst, 'reload schema';

-- The Signal, v1: real headlines, fetched hourly by a Vercel Cron job
-- (see app/api/cron/fetch-news/route.ts and vercel.json), not by any
-- request from a signed-in user. Writes go through the Supabase service
-- role key from that server route, which bypasses RLS entirely -- so
-- there's deliberately no "insert" policy here at all; nobody can post a
-- fake headline through the normal API. Safe to run more than once.

create table if not exists news_articles (
  id uuid default gen_random_uuid() primary key,
  source_name text,
  title text not null,
  description text,
  url text unique not null,
  image_url text,
  published_at timestamptz,
  fetched_at timestamptz default now(),
  query_topic text
);

alter table news_articles enable row level security;

drop policy if exists "Signed-in users see news" on news_articles;
create policy "Signed-in users see news" on news_articles for select using (auth.uid() is not null);

notify pgrst, 'reload schema';

-- Return-engagement streak (see lib/streak.ts, lib/standing.ts). Adds the
-- three columns the Hub needs to track daily check-ins and turns Standing
-- from a static default into something actually earned by XP. Safe to
-- run more than once.

alter table profiles add column if not exists current_streak integer default 0;
alter table profiles add column if not exists longest_streak integer default 0;
alter table profiles add column if not exists last_visit_date date;

notify pgrst, 'reload schema';

-- The Commons Guide: a small, server-only rate-limit log for the AI chat
-- widget in /commons (app/api/commons-guide/route.ts). Only the actual
-- message text never gets stored here on purpose -- this table exists
-- purely to count "how many questions has this person asked today" so a
-- runaway script (or an enthusiastic human) can't blow through the
-- Gemini API budget. Safe to run more than once.

create table if not exists guide_messages (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

alter table guide_messages enable row level security;

-- No select policy on purpose -- nobody needs to read this back through
-- the normal API, including the person who wrote it. The server route
-- uses the service-role client (bypasses RLS) to count today's rows.
drop policy if exists "Users log their own guide messages" on guide_messages;
create policy "Users log their own guide messages" on guide_messages for insert with check (auth.uid() = profile_id);

notify pgrst, 'reload schema';
