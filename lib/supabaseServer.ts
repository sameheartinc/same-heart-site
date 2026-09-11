import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only clients. Never import this file from a "use client" component
// -- SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security entirely and
// must never reach the browser.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseAdmin: SupabaseClient | null =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

// A client scoped to one user's own access token -- respects RLS as that
// user, so an API route can act "as them" without needing the service role.
export function supabaseAsUser(accessToken: string): SupabaseClient | null {
  if (!supabaseUrl || !anonKey) return null;
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
