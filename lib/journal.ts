// Same Heart -- the Capsule Journal: a private, multi-paragraph place
// to write, distinct from three other things this codebase already
// calls something close to this name:
//   - log_entries ("Your log" on the Hub) -- a one-line activity feed
//     ("things you did or earned," per its own comment in
//     supabase/schema.sql), capped at 500 characters, not a place to
//     actually write. journal_entries is its own table rather than
//     stretching that single description column past what it was
//     built for -- same reasoning schema.sql already gives for why
//     notifications got its own table instead of folding into
//     log_entries.
//   - The Signal (app/signal/page.tsx, lib/rssFeeds.ts) -- curated
//     external news, nothing to do with a person's own writing.
//   - Deep Signals (lib/deepSignals.ts) -- fixed, founder-authored
//     unlocks, not user-generated at all.
// Rob, Sep 15 2026: "make sure the capsule feels like a place where
// people can journal... and share their own thoughts." First build is
// private-only, by his own call -- a real place to write, nothing
// more yet. No public read policy exists (see journal_entries' RLS in
// supabase/schema.sql), and nothing here awards XP or counts toward a
// Practice tier: unlike the rest of the Capsule's progression systems,
// there's no trust-building reason to gate this, and no reason to
// incentivize padding entries just to watch a number move -- writing
// one is the whole point. A "share this" step, if Rob wants one
// later, is a separate build on top of these rows, not a flag on them.

import { supabase } from "@/lib/supabaseClient";

export const JOURNAL_TITLE_MAX = 120;
export const JOURNAL_BODY_MAX = 20000;

export interface JournalEntry {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export async function listMyJournalEntries(profileId: string): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, title, body, created_at, updated_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as JournalEntry[];
}

export async function addJournalEntry(
  profileId: string,
  title: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmedBody = body.trim();
  if (!trimmedBody) return { ok: false, error: "Write something first." };
  if (trimmedBody.length > JOURNAL_BODY_MAX) {
    return { ok: false, error: `Keep it under ${JOURNAL_BODY_MAX.toLocaleString()} characters for now.` };
  }
  const trimmedTitle = title.trim().slice(0, JOURNAL_TITLE_MAX);

  const { error } = await supabase.from("journal_entries").insert({
    profile_id: profileId,
    title: trimmedTitle || null,
    body: trimmedBody,
  });
  if (error) return { ok: false, error: error.message || "Couldn't save that right now." };
  return { ok: true };
}

// Not wired to any UI yet (V1 is add + delete only, see IDEAS.md) --
// exported now so editing an entry later doesn't need a second pass
// through journal_entries' RLS to add an update policy.
export async function updateJournalEntry(
  entryId: string,
  title: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmedBody = body.trim();
  if (!trimmedBody) return { ok: false, error: "Write something first." };
  if (trimmedBody.length > JOURNAL_BODY_MAX) {
    return { ok: false, error: `Keep it under ${JOURNAL_BODY_MAX.toLocaleString()} characters for now.` };
  }
  const trimmedTitle = title.trim().slice(0, JOURNAL_TITLE_MAX);

  const { error } = await supabase
    .from("journal_entries")
    .update({ title: trimmedTitle || null, body: trimmedBody, updated_at: new Date().toISOString() })
    .eq("id", entryId);
  if (error) return { ok: false, error: error.message || "Couldn't save that right now." };
  return { ok: true };
}

export async function deleteJournalEntry(entryId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("journal_entries").delete().eq("id", entryId);
  if (error) return { ok: false, error: error.message || "Couldn't remove that right now." };
  return { ok: true };
}
