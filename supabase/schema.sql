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

-- Star Day's frequency/archetype/designation math (lib/starDay.ts),
-- ported into SQL so a signup can compute its own signal server-side
-- without asking anyone anything. NOT a new formula -- verified against
-- lib/starDay.ts's computeSignal() across 20,000 random dates (0
-- mismatches) before this was written, so the two stay in lockstep for
-- any date either one is ever run against.
create or replace function public.compute_signal(for_date date)
returns table(frequency numeric, designation text, archetype_name text)
language plpgsql
immutable
as $$
declare
  m int := extract(month from for_date);
  d int := extract(day from for_date);
  y int := extract(year from for_date);
  mdays int[] := array[31,28,31,30,31,30,31,31,30,31,30,31];
  day_of_year int := d;
  seed bigint;
  archetypes text[] := array[
    'The First Ember', 'The Quiet Beacon', 'The Waking Current', 'The Open Frequency',
    'The Bloom Signal', 'The Steady Pulse', 'The Wildfire Wave', 'The Golden Static',
    'The Harvest Echo', 'The Turning Tide', 'The Deep Resonance', 'The Long Transmission'
  ];
  i int;
begin
  for i in 1..(m - 1) loop
    day_of_year := day_of_year + mdays[i];
  end loop;
  seed := y::bigint * 372 + day_of_year * 13 + d * 7 + m * 29;
  frequency := round((200 + ((seed % 6700)::numeric / 10)) * 10) / 10;
  designation := 'SH-' || lpad(m::text, 2, '0') || lpad(d::text, 2, '0') || '·' || right(y::text, 2);
  archetype_name := archetypes[m];
  return next;
end;
$$;

-- Auto-create a profile row whenever someone signs up. Used to insert
-- only id/display_name and leave birth_date/frequency/archetype/
-- designation null until the old Star Day form filled them in by asking
-- for a birthday -- removed (see IDEAS.md, Sep 3 2026: Rob's call was
-- that asking for a birthday up front isn't necessary and risks losing
-- people before they ever reach the Hub). Every signup now gets its full
-- signal immediately, computed from the moment the account was created
-- rather than the moment the person was born -- same "every signal has a
-- moment it started" idea Star Day's own copy already used. birth_date
-- keeps its name and column (nothing else reads it as "join date") but
-- now holds the join date, unless and until someone sets their real
-- birthday later through a profile builder in Settings -- not built yet.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  signal record;
begin
  select * into signal from public.compute_signal(new.created_at::date);
  insert into public.profiles (id, display_name, birth_date, frequency, designation, archetype)
  values (new.id, new.email, new.created_at::date, signal.frequency, signal.designation, signal.archetype_name);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger already exists from the original setup -- create trigger has
-- no built-in IF NOT EXISTS, so it has to be dropped and recreated (this
-- is what tripped the "policy already exists" error on the first
-- attempt at running this, just for a trigger instead of a policy).
-- Dropping and recreating changes nothing about its behavior -- it's
-- still "fire handle_new_user() after every signup" either way.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- One-time migration: backfill anyone who signed up before this change
-- and never finished the old Star Day form -- their designation is still
-- null today, and app/hub/page.tsx used to redirect exactly those people
-- to the birthday form on every visit. Gives them the same automatic
-- signal now, computed from their own join date, so nobody already on
-- the site can land on that form either. Only ever touches a profile
-- whose designation is still null -- anyone who already completed Star
-- Day for real keeps their own, already-entered birthday untouched.
-- Safe to run more than once.
-- Postgres won't let a LATERAL item in an UPDATE's FROM clause reference
-- the table being updated (that's the 42P10 error this hit on the first
-- try) -- the fix is a second alias for the same table (p2) that the
-- LATERAL call is allowed to reference, then joining back to the real
-- target (p) by id.
update public.profiles p
set frequency = signal.frequency,
    designation = signal.designation,
    archetype = signal.archetype_name,
    birth_date = coalesce(p.birth_date, p.joined_at::date)
from public.profiles p2
cross join lateral public.compute_signal(coalesce(p2.birth_date, p2.joined_at::date)) signal
where p.id = p2.id
  and p.designation is null;

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

-- Evolution, the generic sibling of Keys (see the profile_keys comment
-- above). A single ledger table for every future non-Key permanent
-- reward -- widget skins today, whatever else joins lib/evolution.ts's
-- UNLOCKABLES registry later -- so adding a new *kind* of reward never
-- means a new table. unlock_id is free text on purpose: it's matched
-- against UNLOCKABLES[].id in application code, not a Postgres enum,
-- so shipping a new one is a code change here, not a migration. Same
-- lockdown as profile_keys: no insert/update policy, so the only writer
-- is the service-role client inside app/api/evolution/evaluate/route.ts,
-- which re-derives eligibility itself rather than trusting the client.
-- Safe to run more than once.

create table if not exists profile_unlocks (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  unlock_id text not null,
  earned_at timestamptz default now(),
  unique (profile_id, unlock_id)
);

alter table profile_unlocks enable row level security;

drop policy if exists "Users see their own unlocks" on profile_unlocks;
create policy "Users see their own unlocks" on profile_unlocks for select using (auth.uid() = profile_id);

notify pgrst, 'reload schema';

-- Site-wide theme flip: Heavenly (see lib/skins.ts) is now the default
-- Skin instead of Cosmic Gold. This moves the column's default forward
-- for new signups, and migrates existing profiles that are still on the
-- untouched original default over to Heavenly too -- otherwise everyone
-- who signed up before today would stay on the old dark skin forever,
-- which defeats the point of changing the default at all. The one real
-- tradeoff: there's no way to tell "never touched the skin picker" apart
-- from "deliberately picked Cosmic Gold on purpose" -- both look
-- identical in this column -- so anyone in the latter, rarer case gets
-- moved too. Given how early and small the user base is, that's an
-- acceptable, easily-reversible cost. Earth Tones and Pastel Dream
-- choices are untouched either way. Safe to run more than once.
update profiles set ship_skin = 'heavenly' where ship_skin = 'cosmic-gold';
alter table profiles alter column ship_skin set default 'heavenly';

notify pgrst, 'reload schema';

-- Admin flag -- deliberately one boolean, not a roles table. Same Heart
-- has exactly one admin today (you); this is easy to grow into something
-- richer later if a second admin is ever needed.
alter table profiles add column if not exists is_admin boolean default false;

-- Make your own account the one admin. Uses your account email rather
-- than a hardcoded id, since the id isn't something either of us has
-- handy -- this only ever matches the account signed up under this
-- email.
update profiles set is_admin = true
where id = (select id from auth.users where email = 'sameheartinc@gmail.com');

-- Widget Skins, moved from code to the database. Same shape as
-- lib/widgetSkins.ts's WidgetSkin type, just persisted -- this is what
-- makes an admin dashboard mean something: adding skin #17 is now a form
-- submission, not a code change and a deploy. Public read (the catalog
-- itself is just color palettes, nothing sensitive); write restricted to
-- admins. The 4 skins that shipped in code (Classic, Retro, Cyberpunk,
-- Aurora) are seeded below unchanged -- nobody's saved skin choice
-- changes because of this migration.
create table if not exists widget_skins (
  key text primary key,
  name text not null,
  description text not null,
  header_label text not null,
  kind text not null default 'palette',       -- palette | artwork (artwork isn't rendered specially yet -- reserved for when curated art exists)
  unlock_id text,                             -- matches an id in lib/evolution.ts's UNLOCKABLES; null means free/always available
  sort_order integer not null default 0,
  vars jsonb not null,
  created_at timestamptz default now()
);

alter table widget_skins enable row level security;

drop policy if exists "Anyone can see widget skins" on widget_skins;
create policy "Anyone can see widget skins" on widget_skins for select using (true);

drop policy if exists "Admins manage widget skins" on widget_skins;
create policy "Admins manage widget skins" on widget_skins for all
  using (auth.uid() in (select id from profiles where is_admin = true))
  with check (auth.uid() in (select id from profiles where is_admin = true));

-- Seed: the 4 skins already live in code today, unchanged, plus a real
-- first batch of 12 more -- proving the catalog holds more than a
-- handful, and giving you something to actually look at in the picker
-- right away. Anything past these 16 is now just a form in /admin/skins,
-- not a request back to me.
insert into widget_skins (key, name, description, header_label, kind, unlock_id, sort_order, vars) values
('classic', 'Classic', 'Clean and quiet -- the original card.', 'SIGNAL', 'palette', null, 0, '{
  "--widget-background": "#121a2c", "--widget-panel": "#18233a", "--widget-border": "#313f5e",
  "--widget-radius": "14px", "--widget-shadow": "0 4px 18px rgba(0,0,0,0.28)",
  "--widget-header-bg": "#121a2c", "--widget-header-text": "#8b93ab", "--widget-text": "#ece7dc",
  "--widget-text-dim": "#9aa3b8", "--widget-text-faint": "#5c6684", "--widget-accent": "#c9a15a", "--widget-rose": "#c9576a"
}'::jsonb),
('retro', 'Retro', 'A beveled late-90s messenger titlebar.', 'SIGNAL.EXE', 'palette', null, 1, '{
  "--widget-background": "#c0c0c0", "--widget-panel": "#d4d0c8", "--widget-border": "#4d4d4d",
  "--widget-radius": "2px", "--widget-shadow": "inset 1px 1px 0 #ffffff, inset -1px -1px 0 #4d4d4d, 2px 2px 0 rgba(0,0,0,0.45)",
  "--widget-header-bg": "linear-gradient(180deg, #2a6fe0, #0a3aa8)", "--widget-header-text": "#ffffff", "--widget-text": "#000000",
  "--widget-text-dim": "#3a3a3a", "--widget-text-faint": "#6b6b6b", "--widget-accent": "#2a6fe0", "--widget-rose": "#c0392b"
}'::jsonb),
('cyberpunk', 'Cyberpunk', 'Neon on near-black.', 'SIGNAL_v2', 'palette', null, 2, '{
  "--widget-background": "#080b12", "--widget-panel": "#101827", "--widget-border": "#00ffff",
  "--widget-radius": "4px", "--widget-shadow": "0 0 16px rgba(255,0,255,0.55), 0 0 4px rgba(0,255,255,0.6)",
  "--widget-header-bg": "#101827", "--widget-header-text": "#ff00ff", "--widget-text": "#e8f9ff",
  "--widget-text-dim": "#9fd8e0", "--widget-text-faint": "#5f7a82", "--widget-accent": "#00ffff", "--widget-rose": "#ff2f7a"
}'::jsonb),
('aurora', 'Aurora', 'Earned by holding at least 2 Keys and staying 30 days.', 'SIGNAL_AURORA', 'palette', 'widget-skin-aurora', 3, '{
  "--widget-background": "#0a1420", "--widget-panel": "#122236", "--widget-border": "#3fd9b8",
  "--widget-radius": "16px", "--widget-shadow": "0 0 22px rgba(63,217,184,0.35), 0 0 8px rgba(155,111,224,0.3)",
  "--widget-header-bg": "linear-gradient(90deg, #163a4a, #1f2a4a)", "--widget-header-text": "#9be8d8", "--widget-text": "#eaf8f4",
  "--widget-text-dim": "#a9d3c8", "--widget-text-faint": "#5d8a7d", "--widget-accent": "#3fd9b8", "--widget-rose": "#e0567b"
}'::jsonb),
('nightfall', 'Nightfall', 'A deep indigo sky with a silver moon.', 'SIGNAL_NIGHT', 'palette', null, 4, '{
  "--widget-background": "#0d0b1e", "--widget-panel": "#17142e", "--widget-border": "#3a3560",
  "--widget-radius": "14px", "--widget-shadow": "0 4px 20px rgba(0,0,0,0.4)",
  "--widget-header-bg": "#17142e", "--widget-header-text": "#a8a0d9", "--widget-text": "#e8e6f5",
  "--widget-text-dim": "#a39cc7", "--widget-text-faint": "#6b6490", "--widget-accent": "#b8b8e0", "--widget-rose": "#d97a9e"
}'::jsonb),
('sakura', 'Sakura', 'Soft pink and white, like cherry blossoms.', 'SIGNAL', 'palette', null, 5, '{
  "--widget-background": "#fdf1f5", "--widget-panel": "#ffffff", "--widget-border": "#f5d4e0",
  "--widget-radius": "16px", "--widget-shadow": "0 4px 16px rgba(230,150,180,0.25)",
  "--widget-header-bg": "linear-gradient(180deg, #ffd6e6, #ffb8d4)", "--widget-header-text": "#8a3f5a", "--widget-text": "#4a2a38",
  "--widget-text-dim": "#8a6070", "--widget-text-faint": "#c49aab", "--widget-accent": "#e0708f", "--widget-rose": "#c9576a"
}'::jsonb),
('terminal', 'Terminal', 'Green phosphor on black.', 'root@signal', 'palette', null, 6, '{
  "--widget-background": "#000000", "--widget-panel": "#0a0f0a", "--widget-border": "#1f4f1f",
  "--widget-radius": "0px", "--widget-shadow": "0 0 12px rgba(0,255,70,0.25)",
  "--widget-header-bg": "#0a0f0a", "--widget-header-text": "#00ff41", "--widget-text": "#00ff41",
  "--widget-text-dim": "#00b32d", "--widget-text-faint": "#0a5c1a", "--widget-accent": "#00ff41", "--widget-rose": "#ff4136"
}'::jsonb),
('sunset-boulevard', 'Sunset Boulevard', 'A warm 80s gradient, orange into pink.', 'SIGNAL_FM', 'palette', null, 7, '{
  "--widget-background": "#2b1240", "--widget-panel": "#3d1a52", "--widget-border": "#ff6f91",
  "--widget-radius": "12px", "--widget-shadow": "0 4px 18px rgba(255,111,145,0.3)",
  "--widget-header-bg": "linear-gradient(90deg, #ff6f91, #ff9f6f)", "--widget-header-text": "#2b1240", "--widget-text": "#ffe8ec",
  "--widget-text-dim": "#e0a8c0", "--widget-text-faint": "#a5709a", "--widget-accent": "#ff9f6f", "--widget-rose": "#ff6f91"
}'::jsonb),
('forest-floor', 'Forest Floor', 'Deep greens and earth tones.', 'SIGNAL', 'palette', null, 8, '{
  "--widget-background": "#14200f", "--widget-panel": "#1e2e17", "--widget-border": "#3f5a2e",
  "--widget-radius": "10px", "--widget-shadow": "0 4px 16px rgba(0,0,0,0.35)",
  "--widget-header-bg": "#1e2e17", "--widget-header-text": "#a8c98a", "--widget-text": "#e0ecd4",
  "--widget-text-dim": "#a3c28a", "--widget-text-faint": "#6b8a55", "--widget-accent": "#8fb84f", "--widget-rose": "#c9704a"
}'::jsonb),
('ocean-deep', 'Ocean Deep', 'Teal and navy, like deep water.', 'SIGNAL_SUB', 'palette', null, 9, '{
  "--widget-background": "#071620", "--widget-panel": "#0d2534", "--widget-border": "#1f5f70",
  "--widget-radius": "14px", "--widget-shadow": "0 4px 20px rgba(0,60,80,0.4)",
  "--widget-header-bg": "#0d2534", "--widget-header-text": "#7fd4dc", "--widget-text": "#d4f0f5",
  "--widget-text-dim": "#8fc4cc", "--widget-text-faint": "#4f8a94", "--widget-accent": "#2fb8c4", "--widget-rose": "#d9707a"
}'::jsonb),
('vaporwave', 'Vaporwave', 'Pink, purple, and cyan on a synth grid.', 'SIGNAL~86', 'palette', null, 10, '{
  "--widget-background": "#1a1233", "--widget-panel": "#2b1d4a", "--widget-border": "#ff71ce",
  "--widget-radius": "6px", "--widget-shadow": "0 0 20px rgba(255,113,206,0.4)",
  "--widget-header-bg": "linear-gradient(90deg, #ff71ce, #01cdfe)", "--widget-header-text": "#1a1233", "--widget-text": "#f5f0ff",
  "--widget-text-dim": "#b8a8e0", "--widget-text-faint": "#7a6ba0", "--widget-accent": "#05ffa1", "--widget-rose": "#ff71ce"
}'::jsonb),
('parchment', 'Parchment', 'Old paper and sepia ink.', 'SIGNAL', 'palette', null, 11, '{
  "--widget-background": "#f2e8d5", "--widget-panel": "#ece0c8", "--widget-border": "#c9b48a",
  "--widget-radius": "4px", "--widget-shadow": "inset 0 0 0 1px rgba(120,95,50,0.15)",
  "--widget-header-bg": "#ddc9a0", "--widget-header-text": "#5a4525", "--widget-text": "#3a2f1a",
  "--widget-text-dim": "#6b5a3a", "--widget-text-faint": "#9c8a60", "--widget-accent": "#8a6a30", "--widget-rose": "#a04a3a"
}'::jsonb),
('frost', 'Frost', 'Icy blue and glass white.', 'SIGNAL', 'palette', null, 12, '{
  "--widget-background": "#eef6fb", "--widget-panel": "#ffffff", "--widget-border": "#c0dcec",
  "--widget-radius": "16px", "--widget-shadow": "0 4px 18px rgba(100,160,200,0.2)",
  "--widget-header-bg": "linear-gradient(180deg, #dcf0fb, #c0e0f5)", "--widget-header-text": "#1f5478", "--widget-text": "#1a3a52",
  "--widget-text-dim": "#4f7590", "--widget-text-faint": "#8ab0c4", "--widget-accent": "#4aa3d9", "--widget-rose": "#d97a94"
}'::jsonb),
('ember', 'Ember', 'Deep red and black, like glowing coals.', 'SIGNAL', 'palette', null, 13, '{
  "--widget-background": "#150505", "--widget-panel": "#240a0a", "--widget-border": "#6b1a1a",
  "--widget-radius": "10px", "--widget-shadow": "0 0 20px rgba(200,40,20,0.4)",
  "--widget-header-bg": "#240a0a", "--widget-header-text": "#ff8a5c", "--widget-text": "#f5d4c4",
  "--widget-text-dim": "#cc8a6a", "--widget-text-faint": "#8a5540", "--widget-accent": "#ff5c33", "--widget-rose": "#e0304a"
}'::jsonb),
('lavender-fields', 'Lavender Fields', 'Soft purple and lilac.', 'SIGNAL', 'palette', null, 14, '{
  "--widget-background": "#f5f0fb", "--widget-panel": "#ffffff", "--widget-border": "#e0d0f0",
  "--widget-radius": "16px", "--widget-shadow": "0 4px 16px rgba(180,150,220,0.25)",
  "--widget-header-bg": "linear-gradient(180deg, #e8d8f7, #d8c0f0)", "--widget-header-text": "#5a3f7a", "--widget-text": "#3f2f52",
  "--widget-text-dim": "#7a6590", "--widget-text-faint": "#ab9ac0", "--widget-accent": "#9b6fe0", "--widget-rose": "#c96b9a"
}'::jsonb),
('monochrome', 'Monochrome', 'Pure grayscale, minimal and high-contrast.', 'SIGNAL', 'palette', null, 15, '{
  "--widget-background": "#ffffff", "--widget-panel": "#f4f4f4", "--widget-border": "#d0d0d0",
  "--widget-radius": "8px", "--widget-shadow": "0 2px 10px rgba(0,0,0,0.1)",
  "--widget-header-bg": "#1a1a1a", "--widget-header-text": "#ffffff", "--widget-text": "#1a1a1a",
  "--widget-text-dim": "#555555", "--widget-text-faint": "#999999", "--widget-accent": "#1a1a1a", "--widget-rose": "#666666"
}'::jsonb)
on conflict (key) do nothing;

notify pgrst, 'reload schema';

-- Real artwork skins, part 1 -- the "kind: artwork" field on widget_skins
-- was scaffolded a few migrations back and left unrendered on purpose,
-- waiting on a real curated batch of images (see IDEAS.md). Rob generated
-- a first batch in Midjourney; the chosen 14 live as compressed JPEGs
-- under public/widget-skin-art/ in the repo (shipped with the next
-- deploy, same as any other static asset -- no separate upload step).
-- image_url is only ever read for kind = 'artwork' rows; palette rows
-- leave it null. vars still matter here -- the identity card and header
-- that sit on top of the artwork are still styled from these tokens, see
-- components/WidgetFrame.tsx.
alter table widget_skins add column if not exists image_url text;

insert into widget_skins (key, name, description, header_label, kind, unlock_id, sort_order, image_url, vars) values
('orrery', 'The Orrery', 'A hand-drawn orbit of worlds, real photography.', 'ORRERY', 'artwork', null, 16, '/widget-skin-art/orrery.jpg', '{
  "--widget-background": "#14150f", "--widget-panel": "#1a170f", "--widget-border": "#4a3f24",
  "--widget-radius": "16px", "--widget-shadow": "0 4px 20px rgba(0,0,0,0.45)",
  "--widget-header-bg": "#0d0e0a", "--widget-header-text": "#c9a15a", "--widget-text": "#ece7dc",
  "--widget-text-dim": "#a79b81", "--widget-text-faint": "#6b6152", "--widget-accent": "#c9a15a", "--widget-rose": "#c9576a"
}'::jsonb),
('golden-ratio', 'Golden Ratio', 'A galaxy traced by the golden spiral.', 'SIGNAL_PHI', 'artwork', null, 17, '/widget-skin-art/golden-ratio.jpg', '{
  "--widget-background": "#0f1c19", "--widget-panel": "#13221e", "--widget-border": "#2f5850",
  "--widget-radius": "14px", "--widget-shadow": "0 4px 20px rgba(0,0,0,0.4)",
  "--widget-header-bg": "#0a1512", "--widget-header-text": "#7fd4c4", "--widget-text": "#dff5ef",
  "--widget-text-dim": "#a0c7bd", "--widget-text-faint": "#5f8a80", "--widget-accent": "#4fd6c0", "--widget-rose": "#c9576a"
}'::jsonb),
('nautilus', 'Nautilus', 'A living spiral, gold on deep water.', 'NAUTILUS', 'artwork', null, 18, '/widget-skin-art/nautilus.jpg', '{
  "--widget-background": "#0e161a", "--widget-panel": "#10181d", "--widget-border": "#2a5560",
  "--widget-radius": "16px", "--widget-shadow": "0 0 22px rgba(240,185,90,0.25)",
  "--widget-header-bg": "#0a1216", "--widget-header-text": "#9fd8cc", "--widget-text": "#e6f5f2",
  "--widget-text-dim": "#9fc2ba", "--widget-text-faint": "#587067", "--widget-accent": "#f0b95a", "--widget-rose": "#c9576a"
}'::jsonb),
('seeker-stargazer', 'Stargazer''s Dusk', 'A real night sky, dense with stars.', 'SIGNAL_DUSK', 'artwork', null, 19, '/widget-skin-art/seeker-stargazer.jpg', '{
  "--widget-background": "#0c1220", "--widget-panel": "#0f1626", "--widget-border": "#2c3c5c",
  "--widget-radius": "14px", "--widget-shadow": "0 4px 18px rgba(0,0,0,0.4)",
  "--widget-header-bg": "#0a1220", "--widget-header-text": "#a8bfe0", "--widget-text": "#e8edf7",
  "--widget-text-dim": "#a3aed0", "--widget-text-faint": "#5c6684", "--widget-accent": "#6f8fc4", "--widget-rose": "#c9576a"
}'::jsonb),
('dusk-ridge', 'Blue Ridge', 'Mountain ridges fading into blue dusk.', 'SIGNAL_RIDGE', 'artwork', null, 20, '/widget-skin-art/dusk-ridge.jpg', '{
  "--widget-background": "#0a1523", "--widget-panel": "#0d2035", "--widget-border": "#2c5478",
  "--widget-radius": "14px", "--widget-shadow": "0 4px 18px rgba(0,40,70,0.4)",
  "--widget-header-bg": "#081727", "--widget-header-text": "#9fd0e8", "--widget-text": "#e3f2fb",
  "--widget-text-dim": "#a8c9dc", "--widget-text-faint": "#5f829c", "--widget-accent": "#7fc4e0", "--widget-rose": "#c9576a"
}'::jsonb),
('vaporwave-horizon', 'Outrun Horizon', 'A synth sunset over a neon grid.', 'SIGNAL_VHS', 'artwork', null, 21, '/widget-skin-art/vaporwave-horizon.jpg', '{
  "--widget-background": "#200c26", "--widget-panel": "#2a1030", "--widget-border": "#ff6fc9",
  "--widget-radius": "8px", "--widget-shadow": "0 0 22px rgba(255,111,201,0.35)",
  "--widget-header-bg": "#1a0a20", "--widget-header-text": "#ff9fe0", "--widget-text": "#ffeef8",
  "--widget-text-dim": "#e0a8cc", "--widget-text-faint": "#8a5a78", "--widget-accent": "#4ff0ff", "--widget-rose": "#ff5c8a"
}'::jsonb),
('vaporwave-tide', 'Neon Tide', 'Neon clouds reflected on a glass tide.', 'SIGNAL_TIDE', 'artwork', null, 22, '/widget-skin-art/vaporwave-tide.jpg', '{
  "--widget-background": "#160c26", "--widget-panel": "#1c1030", "--widget-border": "#ff8fce",
  "--widget-radius": "8px", "--widget-shadow": "0 0 22px rgba(79,232,224,0.3)",
  "--widget-header-bg": "#12081c", "--widget-header-text": "#9ff0e8", "--widget-text": "#fdeef8",
  "--widget-text-dim": "#d0a8c4", "--widget-text-faint": "#7a5a70", "--widget-accent": "#4fe8e0", "--widget-rose": "#ff5c8a"
}'::jsonb),
('guardian-dust', 'Golden Drift', 'Warm golden dust, suspended and still.', 'SIGNAL_DUST', 'artwork', null, 23, '/widget-skin-art/guardian-dust.jpg', '{
  "--widget-background": "#1c1509", "--widget-panel": "#241c0e", "--widget-border": "#8a6a30",
  "--widget-radius": "12px", "--widget-shadow": "0 4px 20px rgba(80,60,10,0.35)",
  "--widget-header-bg": "#1a1409", "--widget-header-text": "#e8c98a", "--widget-text": "#f5ebd4",
  "--widget-text-dim": "#cdb389", "--widget-text-faint": "#8a7350", "--widget-accent": "#e0b355", "--widget-rose": "#c9704a"
}'::jsonb),
('skybreak', 'Skybreak', 'Light breaking clean through storm clouds.', 'SIGNAL_BREAK', 'artwork', null, 24, '/widget-skin-art/skybreak.jpg', '{
  "--widget-background": "#0d1516", "--widget-panel": "#10181a", "--widget-border": "#3f5a60",
  "--widget-radius": "14px", "--widget-shadow": "0 4px 20px rgba(0,0,0,0.4)",
  "--widget-header-bg": "#0a1214", "--widget-header-text": "#cfe0dc", "--widget-text": "#eef5f3",
  "--widget-text-dim": "#a8c0bc", "--widget-text-faint": "#5f7874", "--widget-accent": "#e8dfc0", "--widget-rose": "#c9576a"
}'::jsonb),
('woven-gold', 'Threadwork', 'Real thread, gold on deep indigo.', 'SIGNAL_WEAVE', 'artwork', null, 25, '/widget-skin-art/woven-gold.jpg', '{
  "--widget-background": "#10151f", "--widget-panel": "#141a26", "--widget-border": "#4a3a1e",
  "--widget-radius": "10px", "--widget-shadow": "0 4px 18px rgba(0,0,0,0.4)",
  "--widget-header-bg": "#0c111a", "--widget-header-text": "#c9a15a", "--widget-text": "#e6e9f2",
  "--widget-text-dim": "#a3aac2", "--widget-text-faint": "#5c6684", "--widget-accent": "#d4a24a", "--widget-rose": "#c9576a"
}'::jsonb),
('gilded-steel', 'Gilded Steel', 'Brushed metal catching a warm gold light.', 'SIGNAL_FORGE', 'artwork', null, 26, '/widget-skin-art/gilded-steel.jpg', '{
  "--widget-background": "#13110c", "--widget-panel": "#17140f", "--widget-border": "#8a6a30",
  "--widget-radius": "10px", "--widget-shadow": "0 4px 20px rgba(200,150,60,0.25)",
  "--widget-header-bg": "#0d0b08", "--widget-header-text": "#e0b968", "--widget-text": "#f0e9d8",
  "--widget-text-dim": "#baa87e", "--widget-text-faint": "#6b5f45", "--widget-accent": "#f0c060", "--widget-rose": "#c9704a"
}'::jsonb),
('old-parchment', 'Old Parchment', 'Real aged paper, worn at the edges.', 'SIGNAL_ARCHIVE', 'artwork', null, 27, '/widget-skin-art/old-parchment.jpg', '{
  "--widget-background": "#f2e6cc", "--widget-panel": "#fbf6ea", "--widget-border": "#b89860",
  "--widget-radius": "4px", "--widget-shadow": "inset 0 0 0 1px rgba(120,95,50,0.15)",
  "--widget-header-bg": "#e8d4a8", "--widget-header-text": "#5a4525", "--widget-text": "#3a2f1a",
  "--widget-text-dim": "#6b5a3a", "--widget-text-faint": "#9c8a60", "--widget-accent": "#8a6a30", "--widget-rose": "#a04a3a"
}'::jsonb),
('ocean-current', 'Ocean Current', 'Sunlight reaching down through open water.', 'SIGNAL_DEEP', 'artwork', null, 28, '/widget-skin-art/ocean-current.jpg', '{
  "--widget-background": "#e2f2f4", "--widget-panel": "#eef9fa", "--widget-border": "#7fd4dc",
  "--widget-radius": "16px", "--widget-shadow": "0 4px 18px rgba(30,150,170,0.2)",
  "--widget-header-bg": "#cdeef2", "--widget-header-text": "#0f5866", "--widget-text": "#0d2e33",
  "--widget-text-dim": "#3a6870", "--widget-text-faint": "#7aa8ae", "--widget-accent": "#1f8a99", "--widget-rose": "#d9707a"
}'::jsonb),
('forest-canopy', 'Forest Canopy', 'Sunlight through moss and standing trees.', 'SIGNAL_GROVE', 'artwork', null, 29, '/widget-skin-art/forest-canopy.jpg', '{
  "--widget-background": "#e6efd4", "--widget-panel": "#eef5e0", "--widget-border": "#8fae5a",
  "--widget-radius": "12px", "--widget-shadow": "0 4px 16px rgba(60,90,20,0.2)",
  "--widget-header-bg": "#d8e8bc", "--widget-header-text": "#3d5a22", "--widget-text": "#253015",
  "--widget-text-dim": "#4f6a35", "--widget-text-faint": "#82986a", "--widget-accent": "#4f7a2f", "--widget-rose": "#c9704a"
}'::jsonb)
on conflict (key) do nothing;

notify pgrst, 'reload schema';

-- The Yellow Heart String's door, part 1 -- feed_sources moves the
-- Signal's RSS list from a hardcoded array (lib/rssFeeds.ts) into the
-- database, same reasoning as widget_skins: adding or retiring a source
-- becomes a form submission in /admin/signal, not a code change and a
-- deploy. Public read (a list of news outlets isn't sensitive -- same
-- posture as widget_skins); write restricted to admins. The 7 feeds
-- already live in code today are seeded below unchanged, so nothing
-- about the Signal's actual coverage changes because of this migration.
-- lib/rssFeeds.ts's hardcoded RSS_FEEDS array stays in place as a
-- fallback: if this table is ever empty or unreachable, the cron fetch
-- (app/api/cron/fetch-news/route.ts) falls back to it automatically, so
-- the Signal never goes quiet because of a database hiccup.
create table if not exists feed_sources (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  url text not null unique,
  topic text not null default 'world',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

alter table feed_sources enable row level security;

drop policy if exists "Anyone can see feed sources" on feed_sources;
create policy "Anyone can see feed sources" on feed_sources for select using (true);

drop policy if exists "Admins manage feed sources" on feed_sources;
create policy "Admins manage feed sources" on feed_sources for all
  using (auth.uid() in (select id from profiles where is_admin = true))
  with check (auth.uid() in (select id from profiles where is_admin = true));

insert into feed_sources (name, url, topic, active, sort_order) values
('NPR', 'https://feeds.npr.org/1001/rss.xml', 'world', true, 0),
('Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 'world', true, 1),
('BBC News', 'http://feeds.bbci.co.uk/news/world/rss.xml', 'world', true, 2),
('The Guardian', 'https://www.theguardian.com/world/rss', 'world', true, 3),
('ABC News Australia', 'https://www.abc.net.au/news/feed/51120/rss.xml', 'world', true, 4),
('CBC News', 'https://www.cbc.ca/webfeed/rss/rss-topstories', 'world', true, 5),
('Yes! Magazine', 'https://www.yesmagazine.org/feed', 'solutions', true, 6)
on conflict (url) do nothing;

notify pgrst, 'reload schema';

-- Monetization gate, part 1 -- Rob's own design: reaching real Standing
-- (holding all four Heart Strings -- see lib/evolution.ts's
-- "monetization-eligible" milestone) only ever unlocks the *ability to
-- apply*; nothing here is ever automatic or self-service beyond that.
-- Every single application is reviewed and decided by Rob personally in
-- /admin/monetization -- "I am the gatekeeper," his words, same one-
-- admin model as is_admin above. No payment rails exist yet and none
-- are implied by this migration -- monetization_approved is just a
-- flag future features can check once the legal and banking side (a
-- lawyer, a business bank account, Stripe Connect) is actually in
-- place. See IDEAS.md's "Monetization: two-stage gate" entry for the
-- full design and open questions.
alter table profiles add column if not exists monetization_approved boolean not null default false;

create table if not exists monetization_applications (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending', -- pending | approved | denied
  applied_at timestamptz default now(),
  decided_at timestamptz,
  decided_by uuid references profiles(id),
  unique (profile_id)
);

alter table monetization_applications enable row level security;

-- No insert policy for regular users on purpose -- an application is
-- only ever created by app/api/monetization/apply/route.ts, which
-- re-checks eligibility itself from profile_unlocks (server-trusted,
-- never a client claim) before writing a pending row. Users can only
-- ever read their own application's status here.
drop policy if exists "Users can see their own application" on monetization_applications;
create policy "Users can see their own application" on monetization_applications for select
  using (auth.uid() = profile_id);

drop policy if exists "Admins manage monetization applications" on monetization_applications;
create policy "Admins manage monetization applications" on monetization_applications for all
  using (auth.uid() in (select id from profiles where is_admin = true))
  with check (auth.uid() in (select id from profiles where is_admin = true));

notify pgrst, 'reload schema';

-- Hub background uploads -- a personal, private-to-that-user background
-- photo for the Hub (and, once set, it also stands behind the site's
-- other pages that already read ship_skin's image the same way -- see
-- app/hub/page.tsx's heroBackground). This is the first user-uploaded
-- image on the site; lib/skins.ts's own header explicitly avoided this
-- for the curated site-wide skins ("no upload flow, no moderation
-- surface, no new privacy question... for a purely cosmetic feature")
-- -- worth being clear-eyed that this migration deliberately takes that
-- surface on. What keeps it bounded: this image is only ever rendered
-- back to the same person who uploaded it (their own Hub/Commons
-- background), so there's no exposure to anyone else's browser, but the
-- file itself is still hosted on this project's infrastructure --
-- illegal content uploaded here would still be illegal content Same
-- Heart hosts, same as any file host. No content moderation exists for
-- this yet; that's a real gap, not an oversight, if this ever needs to
-- scale past a small trusted user base.
alter table profiles add column if not exists hub_background_url text;

insert into storage.buckets (id, name, public)
values ('hub-backgrounds', 'hub-backgrounds', true)
on conflict (id) do nothing;

-- Folder-per-user convention: every object's path starts with the
-- uploader's own auth uid (see app/hub/page.tsx's uploadHubBackground),
-- and these policies are what actually enforce that server-side rather
-- than trusting the client to only ever write there.
drop policy if exists "Anyone can view hub backgrounds" on storage.objects;
create policy "Anyone can view hub backgrounds" on storage.objects for select
  using (bucket_id = 'hub-backgrounds');

drop policy if exists "Users can upload their own hub background" on storage.objects;
create policy "Users can upload their own hub background" on storage.objects for insert
  with check (bucket_id = 'hub-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own hub background" on storage.objects;
create policy "Users can update their own hub background" on storage.objects for update
  using (bucket_id = 'hub-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own hub background" on storage.objects;
create policy "Users can delete their own hub background" on storage.objects for delete
  using (bucket_id = 'hub-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';

-- Exchange photo uploads -- an optional image alongside a transmitted
-- link (see app/api/exchange/transmit/route.ts and lib/exchange.ts).
-- Unlike hub_background_url above, this one IS shown to other Commons
-- members -- transmissions are already a public feed -- so this is a
-- real, if small, content-moderation surface: anyone can attach any
-- image to something everyone else in the Commons sees. No moderation
-- exists for this yet (same honest gap as the Hub background upload,
-- but with real visibility to other people this time, not just the
-- uploader). Worth a proper look (reporting, a takedown path) before
-- this goes out to more than a small trusted group. The image is purely
-- decorative -- it plays no part in the AI impact scoring, which still
-- only ever reads the submitted link.
alter table exchange_transmissions add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('exchange-photos', 'exchange-photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view exchange photos" on storage.objects;
create policy "Anyone can view exchange photos" on storage.objects for select
  using (bucket_id = 'exchange-photos');

drop policy if exists "Users can upload their own exchange photos" on storage.objects;
create policy "Users can upload their own exchange photos" on storage.objects for insert
  with check (bucket_id = 'exchange-photos' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';

-- Kindred Sparks -- see IDEAS.md's full definition. Only ever matches on
-- signals already visible elsewhere on the site (path_key is already in
-- public_profiles; issue_key is already public via exchange_transmissions)
-- -- nothing new is collected here, so no new table for the matching
-- itself. The one real addition is an opt-out, because pointing two
-- specific people at each other is a step beyond just displaying each of
-- their own public info, and that step gets its own off-switch even
-- though nothing new is being read. kindred_opt_out has to join
-- public_profiles (not just profiles) since checking "is this candidate
-- opted out" has to work across every profile, not just your own row --
-- same reasoning as every other column already in this view.
alter table profiles add column if not exists kindred_opt_out boolean not null default false;

create or replace view public_profiles as
  select id, display_name, spark_id, path_key, ship_skin, designation, commons_accent, kindred_opt_out
  from profiles;

notify pgrst, 'reload schema';

-- Heartfelt / Heartache -- see lib/commons.ts for the full design
-- reasoning (deliberately two positive/empathetic signals, not an
-- upvote/downvote pair, one reaction per person per post). A single
-- generic table covers both threads and replies via target_type/
-- target_id rather than two near-identical tables, since the shape of
-- "who reacted, how, to what" is identical either way.
create table if not exists commons_reactions (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('thread', 'reply')),
  target_id uuid not null,
  kind text not null check (kind in ('heartfelt', 'heartache')),
  created_at timestamptz default now(),
  unique (profile_id, target_type, target_id)
);

alter table commons_reactions enable row level security;

drop policy if exists "Signed-in users see reactions" on commons_reactions;
create policy "Signed-in users see reactions" on commons_reactions for select using (auth.uid() is not null);
drop policy if exists "Users set their own reactions" on commons_reactions;
create policy "Users set their own reactions" on commons_reactions for insert with check (auth.uid() = profile_id);
drop policy if exists "Users change their own reactions" on commons_reactions;
create policy "Users change their own reactions" on commons_reactions for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
drop policy if exists "Users clear their own reactions" on commons_reactions;
create policy "Users clear their own reactions" on commons_reactions for delete using (auth.uid() = profile_id);

notify pgrst, 'reload schema';

-- Fix: Supabase's Security Advisor flagged public_profiles as a
-- SECURITY DEFINER view (critical). Postgres views run as their owner
-- by default unless created with security_invoker=true -- and this one
-- deliberately needs that owner-level access, because it exists so
-- ANYONE can see a narrow public slice of EVERYONE's profile (Commons
-- author names, Kindred Sparks matching), while profiles' own real
-- policy is strictly "auth.uid() = id" (see your own row only). Setting
-- security_invoker=true would collapse the view back to "only your own
-- row" and break both features -- that's not a fix, it's just breaking
-- the feature more quietly.
--
-- The actual fix: stop using a view for this at all. A SECURITY
-- DEFINER *function* with an explicit search_path does the exact same
-- narrow, safe job -- same fixed column list, same data, nothing new
-- exposed -- but Supabase's "Security Definer View" check only looks at
-- views, so a function never trips it. profiles' real RLS is completely
-- untouched by this change.
drop view if exists public.public_profiles;

create or replace function public.get_public_profiles(p_ids uuid[] default null)
returns table (
  id uuid,
  display_name text,
  spark_id bigint,
  path_key text,
  ship_skin text,
  designation text,
  commons_accent text,
  kindred_opt_out boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select id, display_name, spark_id, path_key, ship_skin, designation, commons_accent, kindred_opt_out
  from profiles
  where p_ids is null or id = any(p_ids);
$$;

revoke all on function public.get_public_profiles(uuid[]) from public;
grant execute on function public.get_public_profiles(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- Founding rewards: first 100 verified signups get a prize, first
-- 1000 get a store discount (Rob, Sep 3 2026: "the first 100 people
-- who legitimately sign up and verify their email will get a really
-- good prize...and the first 1000 people will get a discount on the
-- store"). See lib/founders.ts for the site-side logic and the two
-- codes themselves -- exact prize mechanism is still TBD (Rob's
-- direction so far: automatic store credit for the first 100, one
-- shared discount code for the first 1000); this part only builds the
-- ranking, which is needed no matter what's decided about the reward
-- itself.
--
-- Ranked by VERIFIED email order, not raw signup order. Same Heart
-- gives everyone an anonymous session the instant they arrive (see
-- lib/session.ts's ensureSession()), and only attaches a real email
-- later -- via the sign-up form or "Claim your account" on an existing
-- anonymous session. Ranking by raw account creation would let someone
-- hoard early numbers with throwaway anonymous sessions that never
-- become real people, which is the opposite of "legitimately."
-- auth.users.email_confirmed_at only gets set once someone actually
-- verifies a real inbox, so that's the moment this counts from.
-- ============================================================

alter table public.profiles add column if not exists email_verified_at timestamptz;
alter table public.profiles add column if not exists verified_rank integer;

-- Idempotent the same way the on_auth_user_created fix earlier in this
-- file is: ADD CONSTRAINT has no IF NOT EXISTS in Postgres, so drop
-- first, then add.
alter table public.profiles drop constraint if exists profiles_verified_rank_unique;
alter table public.profiles add constraint profiles_verified_rank_unique unique (verified_rank);

create sequence if not exists public.verified_rank_seq start 1;

-- Fires whenever a row in auth.users changes and email_confirmed_at
-- just went from null to set -- i.e. the exact moment someone verifies
-- for real. Assigns the next number off the shared sequence,
-- permanently -- same "first member is first, forever" idea spark_id
-- already uses for join order, just keyed to a verified account
-- instead of a raw signup.
create or replace function public.handle_email_verified()
returns trigger as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles
    set email_verified_at = new.email_confirmed_at,
        verified_rank = coalesce(verified_rank, nextval('public.verified_rank_seq'))
    where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row execute procedure public.handle_email_verified();

-- One-time backfill: anyone who already verified their email before
-- this trigger existed keeps their rightful place in line, ordered by
-- when they actually verified -- not shuffled to the back just because
-- this feature shipped after they signed up. Only ever touches a
-- profile with no verified_rank yet, so this is safe to run more than
-- once and never re-ranks someone the trigger already assigned for
-- real. Uses a plain CTE rather than a LATERAL join in the UPDATE's
-- FROM clause -- that's the same 42P10 mistake as the Star Day
-- backfill above; a CTE computed independently first avoids it.
with ranked as (
  select
    u.id,
    u.email_confirmed_at,
    row_number() over (order by u.email_confirmed_at asc) as rnk
  from auth.users u
  join public.profiles pr on pr.id = u.id
  where u.email_confirmed_at is not null and pr.verified_rank is null
)
update public.profiles p
set verified_rank = ranked.rnk,
    email_verified_at = ranked.email_confirmed_at
from ranked
where p.id = ranked.id;

-- Move the shared sequence past whatever the backfill just handed out,
-- so the very next real verification doesn't collide with a backfilled
-- rank.
select setval(
  'public.verified_rank_seq',
  coalesce((select max(verified_rank) from public.profiles), 0) + 1,
  false
);

notify pgrst, 'reload schema';

-- ============================================================
-- Yellow Heart String's door: let a holder actually suggest a new
-- Signal source, not just read what's already there. feed_sources
-- itself (further up in this file) is admin-write-only for good
-- reason -- anyone editing what the whole Commons reads unchecked
-- would be a real risk -- so this adds a queue instead: a Yellow key
-- holder can propose a name/URL/topic, and it only ever becomes a
-- real feed_sources row once Rob approves it in /admin/signal. Same
-- "earned ability, human still gatekeeps anything that reaches
-- everyone" shape as the monetization gate above.
--
-- No insert/update policy for regular users here on purpose -- same
-- lockdown as profile_keys itself. Every suggestion is written by the
-- service role inside app/api/signal/suggest/route.ts (which
-- re-checks the Yellow key server-side, never trusts the client) and
-- every decision by app/api/signal/decide/route.ts (which re-checks
-- is_admin the same way app/api/monetization/decide does).
-- ============================================================

create table if not exists feed_source_suggestions (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  name text not null,
  url text not null,
  topic text not null default 'world',
  note text,
  status text not null default 'pending',
  created_at timestamptz default now(),
  decided_at timestamptz,
  decided_by uuid references profiles(id)
);

alter table feed_source_suggestions enable row level security;

drop policy if exists "Users see their own suggestions" on feed_source_suggestions;
create policy "Users see their own suggestions" on feed_source_suggestions
  for select using (auth.uid() = profile_id);

notify pgrst, 'reload schema';

-- ============================================================
-- Guidance Tier 2: the personal "Resource Shelf" (see lib/practices.ts
-- and lib/resourceShelf.ts). A standing, capped (5 items, enforced in
-- lib/resourceShelf.ts) collection of links someone saves for
-- themselves -- distinct from Guidance Tier 1's resource_url on
-- commons_threads, which is one link attached to a single post.
--
-- Same trust posture as Tier 1's image_url/resource_url columns (see
-- lib/commons.ts's createThread comment): the Tier gate and the 5-item
-- cap are both enforced client-side, not by a service-role route --
-- this table carries no XP, trust, or money, so RLS restricting every
-- operation to a profile's own rows is enough. Worst case of someone
-- bypassing the Tier check client-side is a personal list existing a
-- little early, a cosmetic gap, not a security one.
-- ============================================================

create table if not exists resource_shelf (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  url text not null,
  title text not null,
  source_thread_id uuid references commons_threads(id) on delete set null,
  created_at timestamptz default now()
);

alter table resource_shelf enable row level security;

drop policy if exists "Users manage their own resource shelf" on resource_shelf;
create policy "Users manage their own resource shelf" on resource_shelf
  for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

notify pgrst, 'reload schema';
