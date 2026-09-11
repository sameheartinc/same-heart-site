-- Same Heart -- Waitlist
-- The "Notify me" form on the landing page. Public insert-only: anyone
-- can join, nobody (besides the project owner via the dashboard) can
-- read the list back through the API. Safe to re-run.

create table if not exists waitlist_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  path_key text references paths(key),
  created_at timestamptz default now()
);

alter table waitlist_emails enable row level security;

drop policy if exists "Anyone can join the waitlist" on waitlist_emails;
create policy "Anyone can join the waitlist"
  on waitlist_emails for insert
  with check (true);
