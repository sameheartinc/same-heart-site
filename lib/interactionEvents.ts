import { supabase } from "@/lib/supabaseClient";

// The substrate for the future curation engine (see PLAN.md's
// "Connecting hearts" section). Nothing reads this yet -- logging
// starts now specifically so real history has accumulated by the time
// curation logic exists to read it (see supabase/schema.sql's
// interaction_events comment). Fire-and-forget everywhere this is
// called: an uncounted interaction is a much smaller cost than an error
// surfacing somewhere a person is just trying to join a community or
// post a reply.
export type InteractionEventType =
  | "joined_community"
  | "started_thread"
  | "posted_reply"
  | "set_reaction"
  | "read_signal_article";

export async function logInteraction(
  eventType: InteractionEventType,
  targetKind: string,
  targetId: string
): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const profileId = sessionData.session?.user.id;
    if (!profileId) return;
    await supabase
      .from("interaction_events")
      .insert({ profile_id: profileId, event_type: eventType, target_kind: targetKind, target_id: targetId });
  } catch {
    // Best-effort -- never worth surfacing an error over a background log.
  }
}
