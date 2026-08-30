import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { COMMONS_ACCENT_PALETTE } from "@/lib/keys";

// Blue key's door. The only writer of profiles.commons_accent -- see the
// column-level revoke in supabase/schema.sql, which makes this route the
// *only* way the column can change, not just the intended way. Checks
// that the Blue key is actually held (never trusts a client claim), and
// only accepts a value from the curated palette rather than free text.

const ALLOWED_COLORS = new Set(COMMONS_ACCENT_PALETTE.map((c) => c.value));

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const color = typeof body?.color === "string" ? body.color : null;
  if (!color || !ALLOWED_COLORS.has(color)) {
    return NextResponse.json({ error: "Not a valid accent color." }, { status: 400 });
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
    .eq("key_color", "blue")
    .maybeSingle();

  if (keyError) {
    console.error("Accent-color key check failed:", keyError.message);
    return NextResponse.json({ error: "Couldn't verify your keys right now." }, { status: 503 });
  }
  if (!heldKey) {
    return NextResponse.json({ error: "The Blue Key unlocks this -- you don't hold it yet." }, { status: 403 });
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ commons_accent: color })
    .eq("id", profileId);

  if (updateError) {
    console.error("Accent-color update failed:", updateError.message);
    return NextResponse.json({ error: "Couldn't save that just now." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, color });
}
