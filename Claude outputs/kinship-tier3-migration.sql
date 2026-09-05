-- Kinship Tier 3 -- "Steady Kinship": a private streak counting
-- calendar days you've shown up for someone (sent an encouragement
-- note), never shown to anyone but you. Deliberately not punishing:
-- missing a day just quietly stops the count rather than resetting
-- with any visible "you broke your streak" moment (contrast with the
-- public, gamified current_streak/longest_streak above, which does
-- show milestones) -- the UI only ever states the current/longest
-- numbers, no negative framing. Same column-level-revoke trust model
-- as current_streak/commons_accent/etc.: kinship_streak_current can
-- only move inside this function (security definer), never from a
-- client update.
alter table profiles add column if not exists kinship_streak_current integer default 0;
alter table profiles add column if not exists kinship_streak_longest integer default 0;
alter table profiles add column if not exists kinship_streak_last_date date;

revoke update (kinship_streak_current, kinship_streak_longest, kinship_streak_last_date) on profiles from authenticated;

create or replace function public.send_encouragement_note(p_reply_id uuid, p_note text)
returns void as $$
declare
  v_recipient uuid;
  v_thread_id uuid;
  v_sender uuid := auth.uid();
  v_kinship_tier integer;
  v_clean text := trim(p_note);
  v_last_date date;
  v_current integer;
  v_longest integer;
begin
  if v_sender is null then
    raise exception 'Sign in first.';
  end if;

  if v_clean = '' or char_length(v_clean) > 280 then
    raise exception 'Notes must be between 1 and 280 characters.';
  end if;

  select coalesce((practice_points->>'kinship')::int, 0) into v_kinship_tier
  from profiles where id = v_sender;

  if coalesce(v_kinship_tier, 0) < 2 then
    raise exception 'Kinship Tier 2 not unlocked yet.';
  end if;

  select profile_id, thread_id into v_recipient, v_thread_id
  from commons_replies where id = p_reply_id;

  if v_recipient is null then
    raise exception 'That reply no longer exists.';
  end if;

  if v_recipient = v_sender then
    raise exception 'You can''t send yourself an encouragement note.';
  end if;

  if exists (
    select 1 from notifications
    where kind = 'encouragement' and actor_id = v_sender and reply_id = p_reply_id
  ) then
    raise exception 'Already sent a note on this reply.';
  end if;

  insert into notifications (profile_id, actor_id, kind, thread_id, reply_id, body)
  values (v_recipient, v_sender, 'encouragement', v_thread_id, p_reply_id, 'left you a note on your reply: "' || v_clean || '"');

  -- Steady Kinship streak -- only the first note of a given calendar
  -- day moves it, so sending several notes in one sitting doesn't
  -- inflate the count.
  select kinship_streak_current, kinship_streak_longest, kinship_streak_last_date
    into v_current, v_longest, v_last_date
    from profiles where id = v_sender;

  if v_last_date is distinct from current_date then
    if v_last_date = current_date - 1 then
      v_current := coalesce(v_current, 0) + 1;
    else
      v_current := 1;
    end if;

    update profiles
      set kinship_streak_current = v_current,
          kinship_streak_longest = greatest(coalesce(v_longest, 0), v_current),
          kinship_streak_last_date = current_date
      where id = v_sender;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.send_encouragement_note(uuid, text) to authenticated;

notify pgrst, 'reload schema';
