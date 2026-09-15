-- Public read for the Commons (Sep 15, 2026) -- Rob: "the same shape as
-- Pinterest and Reddit," confirming the call flagged when this was
-- proposed: "reversing it is worth doing on purpose, with your eyes
-- open about what it means -- real content, including real people's
-- words, becomes visible to search engines and strangers." This is
-- that reversal, for threads/replies in any community that isn't
-- private. Private communities are unaffected -- still fully gated to
-- members only, same as before.
--
-- communities' own SELECT policy has to change too, not just
-- commons_threads/commons_replies -- their policies check
-- communities.is_private in a subquery, and that subquery is itself
-- subject to communities' RLS for whichever role is actually running
-- the query. If communities stayed "auth.uid() is not null" only, an
-- anonymous request's subquery would see zero community rows no matter
-- what, "not exists (... and is_private)" would always evaluate true,
-- and a PRIVATE community's threads would wrongly look public to a
-- signed-out visitor. Fixing communities' policy first is what makes
-- the threads/replies policies below actually safe.
drop policy if exists "Signed-in users see communities" on communities;
create policy "Anyone sees public communities, members see private ones" on communities for select using (
  not coalesce(is_private, false)
  or (auth.uid() is not null and exists (select 1 from community_members cm where cm.community_id = communities.id and cm.profile_id = auth.uid()))
);

drop policy if exists "Signed-in users see threads" on commons_threads;
create policy "Anyone sees public threads, members see private ones" on commons_threads for select using (
  community_id is null
  or not exists (select 1 from communities c where c.id = commons_threads.community_id and coalesce(c.is_private, false))
  or (auth.uid() is not null and exists (select 1 from community_members cm where cm.community_id = commons_threads.community_id and cm.profile_id = auth.uid()))
);

drop policy if exists "Signed-in users see replies" on commons_replies;
create policy "Anyone sees replies on public threads, members see private ones" on commons_replies for select using (
  exists (
    select 1 from commons_threads t
    where t.id = commons_replies.thread_id
    and (
      t.community_id is null
      or not exists (select 1 from communities c where c.id = t.community_id and coalesce(c.is_private, false))
      or (auth.uid() is not null and exists (select 1 from community_members cm where cm.community_id = t.community_id and cm.profile_id = auth.uid()))
    )
  )
);

-- Insert policies are untouched on purpose -- "Users start their own
-- threads" and "Users write their own replies" already require
-- auth.uid() = profile_id, which still means only a signed-in person
-- can ever write. Only reading opened up.

-- Reaction counts (Heartfelt/Heartache) are part of what makes a
-- public thread readable the way Reddit's or Pinterest's counts are --
-- a signed-out visitor should see real numbers, not zeroes, on a
-- thread they're otherwise allowed to read. commons_reactions doesn't
-- carry community_id itself, so this walks to whichever table the
-- reaction targets (commons_threads for a thread reaction, or
-- commons_replies -> its parent thread for a reply reaction) and
-- reuses the exact same public/private test as those tables' own
-- SELECT policies above.
drop policy if exists "Signed-in users see reactions" on commons_reactions;
create policy "Anyone sees reactions on visible threads and replies" on commons_reactions for select using (
  (
    target_type = 'thread' and exists (
      select 1 from commons_threads t
      where t.id = commons_reactions.target_id
      and (
        t.community_id is null
        or not exists (select 1 from communities c where c.id = t.community_id and coalesce(c.is_private, false))
        or (auth.uid() is not null and exists (select 1 from community_members cm where cm.community_id = t.community_id and cm.profile_id = auth.uid()))
      )
    )
  )
  or (
    target_type = 'reply' and exists (
      select 1 from commons_replies r
      join commons_threads t on t.id = r.thread_id
      where r.id = commons_reactions.target_id
      and (
        t.community_id is null
        or not exists (select 1 from communities c where c.id = t.community_id and coalesce(c.is_private, false))
        or (auth.uid() is not null and exists (select 1 from community_members cm where cm.community_id = t.community_id and cm.profile_id = auth.uid()))
      )
    )
  )
);

notify pgrst, 'reload schema';
