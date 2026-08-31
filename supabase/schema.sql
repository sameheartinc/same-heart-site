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

-- The Exchange: an optional bold tagline someone can add to their own
-- transmission -- their own one-line pitch for the link, shown in a
-- randomly-picked bright color every time it renders in the feed (see
-- lib/exchange.ts, app/api/exchange/transmit/route.ts, app/commons/page.tsx).
-- Deliberately nullable and short -- this is flavor text, not a second body,
-- and length is enforced server-side in the transmit route. Note:
-- exchange_transmissions and public_rankings already exist live in your
-- Supabase project but were never added to this file -- a pre-existing gap,
-- not something this line causes. This alter is safe to run against the
-- table as it actually exists, and safe to run more than once.
alter table exchange_transmissions add column if not exists tagline text;

notify pgrst, 'reload schema';

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

-- Keys, the first real piece of the Keys and Doors design further up in
-- this plan. A key is a small, permanent achievement earned from activity
-- that already exists elsewhere on the site -- never spent, never lost,
-- and never granted by the client. profile_keys has no insert/update
-- policy on purpose: the only writer is the service-role client inside
-- app/api/keys/evaluate/route.ts, which recomputes eligibility itself
-- from data it already trusts (e.g. exchange_transmissions, which only
-- the Exchange's own server route ever writes) rather than believing
-- anything a request claims. Safe to run more than once.

create table if not exists profile_keys (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  key_color text not null,
  earned_at timestamptz default now(),
  unique (profile_id, key_color)
);

alter table profile_keys enable row level security;

drop policy if exists "Users see their own keys" on profile_keys;
create policy "Users see their own keys" on profile_keys for select using (auth.uid() = profile_id);

notify pgrst, 'reload schema';

-- Notifications, v1: the first real notification is "someone replied to
-- your thread." Deliberately its own table rather than folding into
-- log_entries -- log_entries is "things you did or earned," this is
-- "things that happened to you that you might not have seen yet," which
-- needs a read/unread state log_entries was never built to carry. `kind`
-- is the seam for more notification types later (a reply to your reply,
-- someone joining a community you started, etc.) without a reshape. Safe
-- to run more than once.

create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  kind text not null default 'reply',
  thread_id uuid references commons_threads(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

alter table notifications enable row level security;

drop policy if exists "Users see their own notifications" on notifications;
create policy "Users see their own notifications" on notifications for select using (auth.uid() = profile_id);

drop policy if exists "Users mark their own notifications read" on notifications;
create policy "Users mark their own notifications read" on notifications for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- No insert policy for anyone -- a notification is only ever created by
-- the narrow function below, the same posture as bump_thread_activity: a
-- controlled cross-user write (the replier creates a row owned by the
-- thread's author), not an open one. security definer so it can insert
-- despite that, but it only ever does this one specific thing, and it
-- quietly no-ops on your own thread so replying to yourself never
-- notifies you.
create or replace function public.notify_thread_reply(p_thread_id uuid)
returns void as $$
declare
  v_owner uuid;
  v_title text;
  v_actor uuid := auth.uid();
begin
  select profile_id, title into v_owner, v_title from commons_threads where id = p_thread_id;
  if v_owner is null or v_owner = v_actor then
    return;
  end if;
  insert into notifications (profile_id, actor_id, kind, thread_id, body)
  values (v_owner, v_actor, 'reply', p_thread_id, 'replied to your thread "' || left(v_title, 60) || '."');
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.notify_thread_reply(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Keys, part 2 -- Blue: breadth in the Commons, earned by posting or
-- replying across several different communities rather than living in
-- just one. See PLAN.md and the comment above profile_keys for the
-- shape. Also fixes public_profiles, which was already serving
-- `designation` to lib/commons.ts's fetchProfilesByIds without this
-- file ever recording that column being added to the view -- a
-- pre-existing gap, not something introduced here.
--
-- commons_accent is Blue's door: a personal accent color that marks
-- someone's name across the Commons, chosen from a small curated
-- palette (lib/keys.ts) rather than free text. It's only ever written
-- by app/api/keys/set-accent/route.ts, which checks profile_keys for
-- "blue" before touching it -- the column-level revoke below is a
-- second, database-level lock making that the *only* way to set it,
-- even for someone calling the anon client directly with their own
-- valid session (the same gap current_streak/longest_streak still
-- have -- this closes it for the one new column this feature adds,
-- rather than leaving a second earned-and-spoofable field).

alter table profiles add column if not exists commons_accent text;

revoke update (commons_accent) on profiles from authenticated;

create or replace view public_profiles as
  select id, display_name, spark_id, path_key, ship_skin, designation, commons_accent
  from profiles;

notify pgrst, 'reload schema';

-- Keys, part 3 -- closing the trust gap the Green/Blue comments already
-- flagged: xp, standing, current_streak, longest_streak, and
-- last_visit_date used to be writable by any authenticated user through
-- the anon client (RLS only checked row ownership, not which columns).
-- app/api/streak/check-in/route.ts and app/api/commons/award-reply/route.ts
-- are now the only two places that ever touch them -- both re-derive the
-- result themselves from data they already trust, never from a client
-- claim. This revoke is what makes that actually enforced, not just
-- convention: even a valid session calling the anon client directly can
-- no longer touch these columns at all. Same reasoning as the
-- commons_accent revoke above; this just finally closes the older gap
-- current_streak had.

revoke update (xp, standing, current_streak, longest_streak, last_visit_date) on profiles from authenticated;

-- Red: presence -- a real return streak, meaning two full weeks of
-- actually showing up on separate days (longest_streak, not
-- current_streak, since a key once earned is permanent even if the
-- streak later breaks -- see PLAN.md). No new table: same profile_keys
-- shape as Green and Blue.
--
-- Red's door is a live "who's actually here right now" view -- the first
-- time last_seen (already tracked for the aggregate presence count in
-- fetchCommonsStats) is exposed as an actual list rather than just a
-- number, and only to people who've proven they show up. Deliberately
-- not added to public_profiles: it's read only by
-- app/api/presence/who-is-here/route.ts using the service role, after
-- that route checks profile_keys for "red" itself -- never a client
-- claim, and never broadened beyond that one gated route.

notify pgrst, 'reload schema';

-- Keys, part 4 -- Yellow's instrumentation: engagement with the Signal.
-- PLAN.md named this the natural second-phase key because, unlike
-- Red/Blue/Green, it needs real tracking that doesn't exist anywhere
-- yet -- this table is that tracking, nothing more. One row per
-- profile+article means re-clicking the same link never counts twice,
-- so this can't be gamed by hammering one article; it only grows by
-- actually engaging with different real stories. Client-inserted (like
-- commons_replies) rather than server-only, since the claim itself
-- ("I clicked through to this") takes genuine, real effort to fake at
-- scale in a way that's meaningfully different from just... reading the
-- news, and nothing here ever awards XP directly -- only the key
-- evaluation route reads it, and it always re-derives eligibility
-- itself rather than trusting a count from the client.

create table if not exists signal_engagement (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  article_id uuid references news_articles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (profile_id, article_id)
);

alter table signal_engagement enable row level security;

drop policy if exists "Users record their own Signal engagement" on signal_engagement;
create policy "Users record their own Signal engagement" on signal_engagement for insert with check (auth.uid() = profile_id);

drop policy if exists "Users see their own Signal engagement" on signal_engagement;
create policy "Users see their own Signal engagement" on signal_engagement for select using (auth.uid() = profile_id);

notify pgrst, 'reload schema';

-- White-theme pass, Aug 31 2026: added a "white-signal" Skin (see
-- lib/skins.ts) alongside the existing cosmic-gold / earth-tones /
-- pastel-dream palettes, and made it the new default so the site reads
-- bright/white out of the box instead of the original dark navy. This
-- moves every existing profile still on the old implicit default over to
-- it, and moves the column default forward for new signups -- mirrors
-- the cosmic-gold migration above. Cosmic Gold itself is untouched and
-- stays one click away in the Hub's Skin picker for anyone who wants the
-- original dark look back. Safe to run more than once.
update profiles set ship_skin = 'white-signal' where ship_skin = 'cosmic-gold';
alter table profiles alter column ship_skin set default 'white-signal';
