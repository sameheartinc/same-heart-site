import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Yellow Heart String's door, part 3 -- the only place a suggestion is
// ever approved or declined, and the only place a suggestion can become
// a real, live feed_sources row. Re-checks is_admin from the database
// itself rather than trusting anything the client claims, same as every
// other admin-only write on this site (app/api/monetization/decide is
// the closest sibling -- this mirrors its shape almost exactly).

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
  const adminId = userData.user.id;

  const { data: adminProfile, error: adminError } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", adminId)
    .single();

  if (adminError || !adminProfile?.is_admin) {
    return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const suggestionId = typeof body.suggestionId === "string" ? body.suggestionId : null;
  const decision = body.decision === "approved" || body.decision === "declined" ? body.decision : null;

  if (!suggestionId || !decision) {
    return NextResponse.json({ error: "Missing suggestionId or decision." }, { status: 400 });
  }

  const { data: suggestion, error: fetchError } = await admin
    .from("feed_source_suggestions")
    .select("id, profile_id, name, url, topic, status")
    .eq("id", suggestionId)
    .single();

  if (fetchError || !suggestion) {
    return NextResponse.json({ error: "Couldn't find that suggestion." }, { status: 404 });
  }
  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: "That suggestion's already been decided." }, { status: 409 });
  }

  const { error: updateError } = await admin
    .from("feed_source_suggestions")
    .update({ status: decision, decided_at: new Date().toISOString(), decided_by: adminId })
    .eq("id", suggestionId);

  if (updateError) {
    console.error("Signal suggestion decision failed:", updateError.message);
    return NextResponse.json({ error: "Couldn't save that decision." }, { status: 503 });
  }

  if (decision === "approved") {
    const { data: maxSortRow } = await admin
      .from("feed_sources")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = (maxSortRow?.sort_order ?? -1) + 1;

    const { error: insertError } = await admin.from("feed_sources").insert({
      name: suggestion.name,
      url: suggestion.url,
      topic: suggestion.topic,
      active: true,
      sort_order: nextSort,
    });

    // 23505 = feed_sources' unique(url) constraint -- the suggested URL
    // is already a live source. Not a real failure; the suggestion is
    // still correctly "approved" either way, so don't leave it stuck.
    if (insertError && insertError.code !== "23505") {
      console.error("Signal suggestion approval insert failed:", insertError.message);
      return NextResponse.json(
        { error: "Decision saved, but couldn't add the source itself -- check /admin/signal." },
        { status: 503 }
      );
    }

    await admin.from("log_entries").insert({
      profile_id: suggestion.profile_id,
      description: `Your Signal suggestion "${suggestion.name}" was added to the Signal.`,
      category: "personal",
      xp_awarded: 0,
    });
  }

  return NextResponse.json({ ok: true });
}
