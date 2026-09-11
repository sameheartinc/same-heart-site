-- Same Heart -- Campaigns
-- Lets anyone turn a cause ("bring sandwiches to the homeless downtown")
-- into a real, AI-suggested outreach plan, and optionally post it for
-- real to Reddit using their own connected account.
--
-- Run this AFTER schema.sql and schema_paths_rewards.sql. Safe to re-run.

-- ---------------------------------------------------------------------
-- Campaigns -- the cause itself, plus the AI-generated outreach kit.
-- ---------------------------------------------------------------------
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text not null,
  location text,
  path_key text references paths(key),
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  suggestions jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table campaigns enable row level security;

drop policy if exists "Anyone can read active or completed campaigns" on campaigns;
create policy "Anyone can read active or completed campaigns"
  on campaigns for select
  using (status in ('active', 'completed') or auth.uid() = creator_id);

drop policy if exists "Creators can insert their own campaigns" on campaigns;
create policy "Creators can insert their own campaigns"
  on campaigns for insert
  with check (auth.uid() = creator_id);

drop policy if exists "Creators can update their own campaigns" on campaigns;
create policy "Creators can update their own campaigns"
  on campaigns for update
  using (auth.uid() = creator_id);

create index if not exists idx_campaigns_creator on campaigns(creator_id);
create index if not exists idx_campaigns_status on campaigns(status);

-- ---------------------------------------------------------------------
-- OAuth connections -- Reddit/Facebook tokens. Deliberately no RLS
-- policies: these are only ever read or written by server-side API
-- routes using the service-role key, never by client JS.
-- ---------------------------------------------------------------------
create table if not exists oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('reddit', 'facebook')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  provider_username text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, provider)
);

alter table oauth_connections enable row level security;

create index if not exists idx_oauth_connections_user on oauth_connections(user_id);

-- ---------------------------------------------------------------------
-- OAuth state -- one-time, short-lived rows that tie an OAuth redirect
-- back to the right user and campaign (CSRF protection). Same lockdown:
-- service-role only.
-- ---------------------------------------------------------------------
create table if not exists oauth_state (
  state text primary key,
  user_id uuid not null references auth.users on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  provider text not null,
  created_at timestamptz default now()
);

alter table oauth_state enable row level security;
