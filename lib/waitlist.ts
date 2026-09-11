import { supabase } from "./supabaseClient";

const UNIQUE_VIOLATION = "23505";

// Best-effort: if Supabase isn't configured, throws so the caller can show
// a graceful "try again later" rather than silently pretending it worked.
export async function joinWaitlist(email: string, pathKey?: string | null): Promise<void> {
  if (!supabase) throw new Error("supabase not configured");
  const { error } = await supabase
    .from("waitlist_emails")
    .insert({ email, path_key: pathKey ?? null });
  if (error && error.code !== UNIQUE_VIOLATION) {
    throw error;
  }
}
