import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Red key's door: "you've proven you show up, so you get to see the
// room." The first time last_seen (already tracked by
// lib/commons.ts's touchPresence for the aggregate count in
// fetchCommonsStats) is exposed as an actual list of people, rather than
// just a number -- and only to people who've earned Red. Checks
// profile_keys itself rather than trusting a client claim, same pattern
// as every other key door.

const PRESENT_WITHIN_MINUTES = 5;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 });
  }
  const profileId = userData.user.id;

  const { data: heldKey, error: keyError } = await admin
    .from("profile_keys")
    .select("key_color")
    .eq("profile_id", profileId)
    .eq("key_color", "red")
    .maybeSingle();

  if (keyError) {
    console.error("Presence: key check failed:", keyError.message);
    return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
  }
  if (!heldKey) {
    return NextResponse.json({ error: "The Red Key unlocks this -- you don't hold it yet." }, { status: 403 });
  }

  const cutoff = new Date(Date.now() - PRESENT_WITHIN_MINUTES * 60 * 1000).toISOString();
  const { data: present, error: presentError } = await admin
    .from("profiles")
    .select("id, display_name, spark_id, designation")
    .gte("last_seen", cutoff)
    .order("last_seen", { ascending: false });

  if (presentError) {
    console.error("Presence: lookup failed:", presentError.message);
    return NextResponse.json({ error: "Couldn't load who's here right now." }, { status: 503 });
  }

  return NextResponse.json({ present: present ?? [] });
}
