-- Same Heart -- Peer Support Intake
-- The real first step of the peer support system Rob's described from
-- the start: intake, matching, ongoing check-ins. This migration only
-- covers intake -- someone saying what they're going through, whether
-- they're looking for support or willing to give it, and how often they
-- want to check in. Matching and check-ins are later passes; nothing
-- here assumes they exist yet.
--
-- Run this AFTER schema.sql, in the Supabase SQL editor. Safe to re-run.

create table if not exists peer_support_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('seeking', 'offering', 'both')),
  focus_areas text[] not null default '{}',
  frequency text not null check (frequency in ('daily', 'few_times_week', 'weekly', 'occasional')),
  context text,
  notes text,
  -- pending: waiting to be matched. matched/closed are reserved for the
  -- matching pass that comes later -- nothing in this migration ever
  -- sets them, but the column exists now so that pass doesn't need its
  -- own schema change.
  status text not null default 'pending' check (status in ('pending', 'matched', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table peer_support_intakes enable row level security;

drop policy if exists "Users can view their own intake" on peer_support_intakes;
create policy "Users can view their own intake"
  on peer_support_intakes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can submit their own intake" on peer_support_intakes;
create policy "Users can submit their own intake"
  on peer_support_intakes for insert
  with check (auth.uid() = user_id);

-- Editing is only allowed while still pending -- once a future matching
-- pass marks a row matched or closed, it becomes a record rather than a
-- form the person can keep changing.
drop policy if exists "Users can update their own pending intake" on peer_support_intakes;
create policy "Users can update their own pending intake"
  on peer_support_intakes for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id);

create index if not exists idx_peer_support_intakes_user on peer_support_intakes(user_id);
create index if not exists idx_peer_support_intakes_status on peer_support_intakes(status);

-- Only one active (pending) intake per person -- submitting again while
-- already pending edits that same row instead of creating a second one
-- (see lib/peerSupport.ts's submitIntake).
create unique index if not exists idx_peer_support_one_pending
  on peer_support_intakes(user_id)
  where status = 'pending';
