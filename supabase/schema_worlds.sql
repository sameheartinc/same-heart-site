-- Same Heart -- Worlds (discoverable rewards)
-- Adds the four hidden "discoverable" rewards -- one per path -- found by
-- moving through that path's world in a way that fits its character.
-- Run this AFTER schema_paths_rewards.sql. Safe to re-run.

insert into rewards_catalog (key, title, description, kind, path_key, giftable, sort_order) values
  ('guardian_earth_find', 'A Steady Place', 'You found a patch of ground that does not move, even when you do.', 'unlock', 'guardian', true, 40),
  ('seeker_star_find', 'A Named Star', 'You found the one light that was waiting for you to notice it.', 'unlock', 'seeker', true, 41),
  ('weaver_current_find', 'A Warm Current', 'You found where the water already knew where it was going.', 'unlock', 'weaver', true, 42),
  ('flame_ember_find', 'A Live Coal', 'You found the one ember that had not gone out yet.', 'unlock', 'flame', true, 43)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  kind = excluded.kind,
  path_key = excluded.path_key,
  giftable = excluded.giftable,
  sort_order = excluded.sort_order;
