import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Stewardship's review queue, part 1 -- the admin queue's read side.
// commons_flags' RLS only ever lets someone see their OWN flags (see
// supabase/schema.sql), so the admin view -- which needs every pending
// flag plus who raised it and who the target belongs to -- has to come
// from a server route running with the service role, same shape as
// app/api/monetization/list/route.ts. Re-checks is_admin itself rather
// than trusting anything the client claims.
//
// A flagged target is either a commons_thread or a commons_reply
// (target_type/target_id, see commons_flags' comment) -- this route
// fetches whichever kind each flag points to and returns a short
// preview plus the target's own author, so the admin queue reads as
// "here's the actual content in question," not just an opaque id.

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

  const { data: flags, error: flagsError } = await admin
    .from("commons_flags")
    .select("id, profile_id, target_type, target_id, category, status, created_at, resolved_at, resolved_by")
    .order("created_at", { ascending: true });

  if (flagsError) {
    console.error("Stewardship flags list failed:", flagsError.message);
    return NextResponse.json({ error: "Couldn't load flags." }, { status: 503 });
  }

  const rows = flags ?? [];
  const threadIds = Array.from(new Set(rows.filter((f) => f.target_type === "thread").map((f) => f.target_id)));
  const replyIds = Array.from(new Set(rows.filter((f) => f.target_type === "reply").map((f) => f.target_id)));

  const threadsById: Record<string, { title: string; body: string; profile_id: string }> = {};
  const repliesById: Record<string, { body: string; profile_id: string; thread_id: string }> = {};

  if (threadIds.length > 0) {
    const { data: threads } = await admin
      .from("commons_threads")
      .select("id, title, body, profile_id")
      .in("id", threadIds);
    for (const t of threads ?? []) threadsById[t.id] = { title: t.title, body: t.body, profile_id: t.profile_id };
  }

  if (replyIds.length > 0) {
    const { data: replies } = await admin
      .from("commons_replies")
      .select("id, body, profile_id, thread_id")
      .in("id", replyIds);
    for (const r of replies ?? []) repliesById[r.id] = { body: r.body, profile_id: r.profile_id, thread_id: r.thread_id };
  }

  const profileIds = Array.from(
    new Set([
      ...rows.map((f) => f.profile_id),
      ...Object.values(threadsById).map((t) => t.profile_id),
      ...Object.values(repliesById).map((r) => r.profile_id),
    ])
  );

  const profilesById: Record<string, { display_name: string | null; spark_id: number | null }> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("id, display_name, spark_id").in("id", profileIds);
    for (const p of profiles ?? []) profilesById[p.id] = { display_name: p.display_name, spark_id: p.spark_id };
  }

  function nameFor(id: string | null) {
    if (!id) return null;
    const p = profilesById[id];
    if (!p) return null;
    return p.display_name || (p.spark_id ? `Spark #${String(p.spark_id).padStart(5, "0")}` : null);
  }

  const result = rows.map((f) => {
    const threadId = f.target_type === "thread" ? f.target_id : repliesById[f.target_id]?.thread_id ?? null;
    const preview =
      f.target_type === "thread"
        ? threadsById[f.target_id]?.title ?? threadsById[f.target_id]?.body ?? "(deleted thread)"
        : repliesById[f.target_id]?.body ?? "(deleted reply)";
    const targetAuthorId = f.target_type === "thread" ? threadsById[f.target_id]?.profile_id : repliesById[f.target_id]?.profile_id;

    return {
      id: f.id,
      targetType: f.target_type,
      targetId: f.target_id,
      threadId,
      category: f.category,
      status: f.status,
      createdAt: f.created_at,
      resolvedAt: f.resolved_at,
      reporterName: nameFor(f.profile_id),
      targetAuthorName: nameFor(targetAuthorId ?? null),
      preview: preview.slice(0, 240),
    };
  });

  return NextResponse.json({ flags: result });
}
