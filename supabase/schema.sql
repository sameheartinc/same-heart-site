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
  ship_skin text default '#c9a15a',         -- aura/hue color
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
