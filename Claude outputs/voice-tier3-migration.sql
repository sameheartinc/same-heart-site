-- Voice Tier 3 -- "your original threads carry a quiet Voice marker
-- next to your name" (Sep 5 2026, see lib/practices.ts). Showing that
-- marker on someone ELSE's thread means every viewer needs to be able
-- to read that author's practice_points, which get_public_profiles
-- never exposed before now. Same trust shape as everything else this
-- function returns: read-only, narrow, and nothing sensitive --
-- practice_points is no more revealing than xp/standing, which are
-- already public (see the Roster). Postgres won't let CREATE OR
-- REPLACE change a function's output column list (same "cannot change
-- return type" wall as every other RETURNS TABLE change in this file)
-- so this drops and recreates rather than replacing in place.
drop function if exists public.get_public_profiles(uuid[]);

create function public.get_public_profiles(p_ids uuid[] default null)
returns table (
  id uuid,
  display_name text,
  spark_id bigint,
  path_key text,
  ship_skin text,
  designation text,
  commons_accent text,
  kindred_opt_out boolean,
  practice_points jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select id, display_name, spark_id, path_key, ship_skin, designation, commons_accent, kindred_opt_out, practice_points
  from profiles
  where p_ids is null or id = any(p_ids);
$$;

revoke all on function public.get_public_profiles(uuid[]) from public;
grant execute on function public.get_public_profiles(uuid[]) to anon, authenticated;
