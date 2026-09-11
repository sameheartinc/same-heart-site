-- Same Heart -- Paths & Rewards
-- Adds: the four paths people sort into, per-user path assignment, a
-- reward/gift catalog, and the grant + gifting functions that hand
-- rewards out safely.
--
-- Run this AFTER schema.sql, in the Supabase SQL editor. Safe to re-run:
-- every statement is idempotent.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- The four paths
-- ---------------------------------------------------------------------
create table if not exists paths (
  key text primary key,
  name text not null,
  tagline text not null,
  essence text not null,
  accent text not null,
  sort_order int not null default 0
);

alter table paths enable row level security;

drop policy if exists "Anyone can read the four paths" on paths;
create policy "Anyone can read the four paths"
  on paths for select
  using (true);

insert into paths (key, name, tagline, essence, accent, sort_order) values
  ('guardian', 'The Guardian', 'Steady is its own kind of brave.',
   'Grounded and protective -- the calm at the center of the room.', '#c9a15a', 1),
  ('seeker', 'The Seeker', 'Still curious about everything.',
   'Restless and exploratory -- always circling toward the unknown.', '#7c9fd9', 2),
  ('weaver', 'The Weaver', 'It finds the thread between people.',
   'Connective and empathetic -- drawn to whoever is standing alone.', '#c9576a', 3),
  ('flame', 'The Flame', 'It shows up loud because it means it.',
   'Passionate and expressive -- the spark that starts the room talking.', '#e0703a', 4)
on conflict (key) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  essence = excluded.essence,
  accent = excluded.accent,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- Extend profiles with the path each person was quietly assigned
-- ---------------------------------------------------------------------
alter table profiles add column if not exists path_key text references paths(key);
alter table profiles add column if not exists path_confidence numeric;
alter table profiles add column if not exists path_signals jsonb default '{}'::jsonb;
alter table profiles add column if not exists path_assigned_at timestamptz;

-- ---------------------------------------------------------------------
-- Reward catalog -- the versatile gift types the site can hand out.
-- path_key = null means the reward is universal; otherwise it's flavored
-- for one specific path. giftable = a holder can pay it forward to
-- someone else via a gift code.
-- ---------------------------------------------------------------------
create table if not exists rewards_catalog (
  key text primary key,
  title text not null,
  description text not null,
  kind text not null check (kind in ('badge', 'unlock', 'message', 'pass', 'spark')),
  path_key text references paths(key),
  giftable boolean not null default false,
  sort_order int not null default 0
);

alter table rewards_catalog enable row level security;

drop policy if exists "Anyone can read the reward catalog" on rewards_catalog;
create policy "Anyone can read the reward catalog"
  on rewards_catalog for select
  using (true);

insert into rewards_catalog (key, title, description, kind, path_key, giftable, sort_order) values
  ('first_signal', 'First Signal', 'You showed up before the doors even opened.', 'badge', null, false, 1),
  ('path_revealed', 'Named', 'The site quietly recognized which path you walk.', 'badge', null, false, 2),
  ('resonance_pause', 'Resonance', 'You lingered on the heart long enough for it to notice.', 'unlock', null, true, 3),
  ('guardian_watch', 'The Watch', 'A steady presence, offered back to you.', 'message', 'guardian', true, 10),
  ('seeker_map', 'A Loose Map', 'For someone who was never going to follow a straight line.', 'message', 'seeker', true, 11),
  ('weaver_thread', 'A Spare Thread', 'For tying two people together who hadn''t met yet.', 'message', 'weaver', true, 12),
  ('flame_spark', 'A Spark', 'Something to hand to the next room you walk into.', 'message', 'flame', true, 13),
  ('pay_it_forward', 'Pay It Forward', 'A reward you can only ever receive by someone else choosing to give it to you.', 'spark', null, true, 20)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  kind = excluded.kind,
  path_key = excluded.path_key,
  giftable = excluded.giftable,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- Reward grants -- who actually holds what. No insert/update/delete
-- policy is defined on purpose: the only way rows appear here is through
-- the security-definer functions below, never directly from the client.
-- ---------------------------------------------------------------------
create table if not exists reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  reward_key text not null references rewards_catalog(key),
  meta jsonb default '{}'::jsonb,
  granted_at timestamptz default now(),
  unique (user_id, reward_key)
);

alter table reward_grants enable row level security;

drop policy if exists "Users can view their own reward grants" on reward_grants;
create policy "Users can view their own reward grants"
  on reward_grants for select
  using (auth.uid() = user_id);

create index if not exists idx_reward_grants_user on reward_grants(user_id);

-- ---------------------------------------------------------------------
-- Gift codes -- how a reward gets handed from one person to another.
-- Same lockdown: readable by the two people involved, writable only
-- through the functions below.
-- ---------------------------------------------------------------------
create table if not exists gift_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  reward_key text not null references rewards_catalog(key),
  created_by uuid not null references auth.users on delete cascade,
  redeemed_by uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  redeemed_at timestamptz
);

alter table gift_codes enable row level security;

drop policy if exists "Users can view gift codes they created or redeemed" on gift_codes;
create policy "Users can view gift codes they created or redeemed"
  on gift_codes for select
  using (auth.uid() = created_by or auth.uid() = redeemed_by);

create index if not exists idx_gift_codes_created_by on gift_codes(created_by);

-- ---------------------------------------------------------------------
-- grant_reward(reward_key, meta) -- idempotent grant to the caller.
-- Returns whether this call is what actually granted it (so the UI can
-- show a "new reward" moment only once).
-- ---------------------------------------------------------------------
create or replace function public.grant_reward(p_reward_key text, p_meta jsonb default '{}'::jsonb)
returns table (id uuid, reward_key text, granted_at timestamptz, newly_granted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing reward_grants%rowtype;
  v_new reward_grants%rowtype;
begin
  if v_uid is null then
    raise exception 'must be signed in to receive a reward';
  end if;

  if not exists (select 1 from rewards_catalog where key = p_reward_key) then
    raise exception 'unknown reward: %', p_reward_key;
  end if;

  select * into v_existing from reward_grants rg
    where rg.user_id = v_uid and rg.reward_key = p_reward_key;

  if found then
    return query select v_existing.id, v_existing.reward_key, v_existing.granted_at, false;
    return;
  end if;

  insert into reward_grants (user_id, reward_key, meta)
  values (v_uid, p_reward_key, p_meta)
  returning * into v_new;

  return query select v_new.id, v_new.reward_key, v_new.granted_at, true;
end;
$$;

-- ---------------------------------------------------------------------
-- create_gift_code(reward_key) -- mint a one-time code for a reward you
-- already hold, so you can hand it to someone specific.
-- ---------------------------------------------------------------------
create or replace function public.create_gift_code(p_reward_key text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_giftable boolean;
  v_code text;
begin
  if v_uid is null then
    raise exception 'must be signed in to gift';
  end if;

  select giftable into v_giftable from rewards_catalog where key = p_reward_key;
  if v_giftable is null then
    raise exception 'unknown reward: %', p_reward_key;
  end if;
  if not v_giftable then
    raise exception 'this reward cannot be gifted';
  end if;

  if not exists (
    select 1 from reward_grants where user_id = v_uid and reward_key = p_reward_key
  ) then
    raise exception 'you can only gift a reward you already hold';
  end if;

  v_code := encode(gen_random_bytes(6), 'hex');

  insert into gift_codes (code, reward_key, created_by)
  values (v_code, p_reward_key, v_uid);

  return v_code;
end;
$$;

-- ---------------------------------------------------------------------
-- redeem_gift_code(code) -- claim a code someone gave you.
-- ---------------------------------------------------------------------
create or replace function public.redeem_gift_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row gift_codes%rowtype;
begin
  if v_uid is null then
    raise exception 'must be signed in to redeem a gift';
  end if;

  select * into v_row from gift_codes where code = p_code for update;
  if not found then
    raise exception 'gift code not found';
  end if;
  if v_row.redeemed_by is not null then
    raise exception 'gift code already redeemed';
  end if;
  if v_row.created_by = v_uid then
    raise exception 'you cannot redeem your own gift code';
  end if;

  update gift_codes set redeemed_by = v_uid, redeemed_at = now()
    where code = p_code;

  insert into reward_grants (user_id, reward_key, meta)
  values (v_uid, v_row.reward_key, jsonb_build_object('gifted_by', v_row.created_by))
  on conflict (user_id, reward_key) do nothing;

  return v_row.reward_key;
end;
$$;
