"use client";

import { supabase } from "./supabaseClient";
import { getTurnstileToken } from "./turnstile";

// Gives every visitor a stable identity without a sign-in screen, using
// Supabase anonymous auth (enable it in Dashboard -> Authentication ->
// Providers -> Anonymous Sign-ins). That's what lets Path, Star Day, XP,
// and Skins persist and work across a refresh before someone ever adds a
// real email. When they want a permanent, recoverable account later, the
// "Claim your account" flow on /login upgrades this same session in
// place with supabase.auth.updateUser({ email, password }) -- same
// profile row, same Spark ID, nothing lost.
//
// Turnstile (lib/turnstile.ts) gates the sign-in so scripted abuse can't
// mint free anonymous accounts -- invisible for real visitors, only
// surfaces a challenge when Cloudflare's risk score calls for one.
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const captchaToken = await getTurnstileToken();
  const { data: signedIn, error } = await supabase.auth.signInAnonymously(
    captchaToken ? { options: { captchaToken } } : undefined
  );
  if (error) throw error;
  return signedIn.session;
}
