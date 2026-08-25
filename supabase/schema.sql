-- Same Heart -- starter schema for the "signed-in Universe"
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).

-- One row per person, created automatically when they sign up.
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  preferences jsonb default '{}'::jsonb,   -- e.g. which community channels they follow
  ship_state jsonb default '{}'::jsonb,    -- saved progress / settings for the personal dashboard
  observatory_opt_in boolean default false, -- true only if they've opted into the Gazing Eye view
  created_at timestamptz default now()
);

-- Row Level Security: a person can only read/edit their own row.
alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
