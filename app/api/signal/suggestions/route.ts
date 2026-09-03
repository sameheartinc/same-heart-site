import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Yellow Heart String's door, part 2 (admin read side) -- profiles' RLS
// only ever lets someone read their own row (same reasoning as
// app/api/monetization/list), so /admin/signal can't join a suggester's
// display name client-side. This route re-checks is_admin itself and
// does the join server-side with the service role, which can see every
// row.

export async function GET(request: NextRequest) {
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

  const { data: adminProfile, error: adminError } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .single();

  if (adminError || !adminProfile?.is_admin) {
    return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
  }

  const { data: suggestions, error: suggestionsError } = await admin
    .from("feed_source_suggestions")
    .select("id, profile_id, name, url, topic, note, status, created_at, decided_at")
    .order("created_at", { ascending: true });

  if (suggestionsError) {
    console.error("Signal suggestions list failed:", suggestionsError.message);
    return NextResponse.json({ error: "Couldn't load suggestions." }, { status: 503 });
  }

  const profileIds = Array.from(new Set((suggestions ?? []).map((s) => s.profile_id)));
  const namesById: Record<string, string | null> = {};

  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", profileIds);

    if (profilesError) {
      console.error("Signal suggestion profile lookup failed:", profilesError.message);
      return NextResponse.json({ error: "Couldn't load suggester details." }, { status: 503 });
    }
    for (const p of profiles ?? []) namesById[p.id] = p.display_name;
  }

  const rows = (suggestions ?? []).map((s) => ({
    id: s.id,
    profileId: s.profile_id,
    displayName: namesById[s.profile_id] ?? null,
    name: s.name,
    url: s.url,
    topic: s.topic,
    note: s.note,
    status: s.status,
    createdAt: s.created_at,
    decidedAt: s.decided_at,
  }));

  return NextResponse.json({ suggestions: rows });
}
