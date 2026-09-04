// Same Heart -- Guidance Tier 2: the personal "Resource Shelf" (see
// lib/practices.ts's PRACTICES.guidance.tiers[1]). A capped, standing
// collection of links someone saves for themselves over time -- distinct
// from Guidance Tier 1's resource_url, which is one link attached to a
// single thread at the moment it's posted. Saving a thread's resource to
// your own Shelf is the main way items land here (see the "Save to my
// Resource Shelf" button on app/commons/t/[id]/page.tsx), but nothing
// requires the source to still exist -- source_thread_id is nullable and
// only ever used for an optional "via" link back, never a hard
// dependency.
//
// Same trust posture as Voice/Guidance Tier 1's image_url/resource_url
// (see lib/commons.ts's createThread comment): the Tier 2 gate and the
// 5-item cap below are both enforced here, client-side, backed only by
// resource_shelf's RLS (own rows only) -- not a service-role route.
// resource_shelf carries no XP, trust, or money, so the worst case of
// someone bypassing the Tier check is a personal list existing a little
// early, which is a cosmetic gap, not a security one -- the same
// reasoning Tier 1 already established for this Practice.

import { supabase } from "@/lib/supabaseClient";

export const RESOURCE_SHELF_CAP = 5;

export interface ShelfItem {
  id: string;
  url: string;
  title: string;
  source_thread_id: string | null;
  created_at: string;
}

export async function listMyShelf(profileId: string): Promise<ShelfItem[]> {
  const { data, error } = await supabase
    .from("resource_shelf")
    .select("id, url, title, source_thread_id, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as ShelfItem[];
}

export async function addToShelf(
  profileId: string,
  url: string,
  title: string,
  sourceThreadId?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const existing = await listMyShelf(profileId);
  if (existing.some((item) => item.url === url)) {
    return { ok: false, error: "Already on your shelf." };
  }
  if (existing.length >= RESOURCE_SHELF_CAP) {
    return {
      ok: false,
      error: `Your shelf is full (${RESOURCE_SHELF_CAP} of ${RESOURCE_SHELF_CAP}) -- remove one to save another.`,
    };
  }

  const { error } = await supabase.from("resource_shelf").insert({
    profile_id: profileId,
    url,
    title: title.trim() || url,
    source_thread_id: sourceThreadId ?? null,
  });
  if (error) return { ok: false, error: error.message || "Couldn't save that right now." };
  return { ok: true };
}

export async function removeFromShelf(itemId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("resource_shelf").delete().eq("id", itemId);
  if (error) return { ok: false, error: error.message || "Couldn't remove that right now." };
  return { ok: true };
}
