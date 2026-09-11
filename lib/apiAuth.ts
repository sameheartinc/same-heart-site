import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabaseServer";

// Verifies the caller's Supabase access token (sent as a normal bearer
// token from client fetches) and returns the authenticated user, or null.
// Server-only.
export async function getAuthedUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || !supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, accessToken: token };
}
