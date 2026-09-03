import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Yellow Heart String's door, part 1 -- the only place a Signal source
// suggestion is ever created. Re-checks the Yellow key server-side from
// profile_keys (never trusts the client) before allowing an insert, same
// trust model as every other key-gated write on this site (see
// app/api/keys/set-accent, app/api/monetization/apply). This never
// touches the live feed_sources table itself -- it only ever writes a
// pending feed_source_suggestions row; app/api/signal/decide is the one
// place a suggestion can become a real, live source, and only Rob can
// call it.

const MAX_NAME = 80;
const MAX_URL = 500;
const MAX_NOTE = 400;
const MAX_PENDING_PER_PROFILE = 3;

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

  const { data: keyRow, error: keyError } = await admin
    .from("profile_keys")
    .select("key_color")
    .eq("profile_id", profileId)
    .eq("key_color", "yellow")
    .maybeSingle();

  if (keyError) {
    console.error("Signal suggestion key check failed:", keyError.message);
    return NextResponse.json({ error: "Couldn't check your Heart Strings right now." }, { status: 503 });
  }
  if (!keyRow) {
    return NextResponse.json({ error: "This needs the Yellow Heart String." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const topic = typeof body.topic === "string" && body.topic.trim() ? body.topic.trim().toLowerCase() : "world";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ error: "Give it a short, real name." }, { status: 400 });
  }
  if (!/^https?:\/\/.+/i.test(url) || url.length > MAX_URL) {
    return NextResponse.json({ error: "That doesn't look like a valid feed URL." }, { status: 400 });
  }
  if (note.length > MAX_NOTE) {
    return NextResponse.json({ error: "Keep the note under 400 characters." }, { status: 400 });
  }

  const { count: pendingCount, error: pendingError } = await admin
    .from("feed_source_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("status", "pending");

  if (pendingError) {
    console.error("Signal suggestion pending check failed:", pendingError.message);
    return NextResponse.json({ error: "Couldn't check your pending suggestions right now." }, { status: 503 });
  }
  if ((pendingCount ?? 0) >= MAX_PENDING_PER_PROFILE) {
    return NextResponse.json(
      {
        error: `You already have ${MAX_PENDING_PER_PROFILE} suggestions waiting on a decision -- wait for those before sending more.`,
      },
      { status: 429 }
    );
  }

  const { error: insertError } = await admin
    .from("feed_source_suggestions")
    .insert({ profile_id: profileId, name, url, topic, note: note || null });

  if (insertError) {
    console.error("Signal suggestion insert failed:", insertError.message);
    return NextResponse.json({ error: "Couldn't submit your suggestion right now." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
