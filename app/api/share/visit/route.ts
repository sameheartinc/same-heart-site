import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordShareVisit } from "@/lib/xpEngine";

// The one door a tracked share link's click-through walks through (see
// lib/shareAttribution.ts). Deliberately open to anonymous callers --
// the whole point is a stranger who clicked a shared link, not someone
// with an account yet -- so this can only ever record a plain visit
// count for the sharer to see (no XP; see lib/xpEngine.ts's
// recordShareVisit and Rob's Sep 22, 2026 call). The real reward for
// sharing is a completed signup, which never touches this route at all
// -- it goes through the existing referral system untouched.
export async function POST(request: NextRequest) {
  const admin = supabaseAdmin();

  let sparkId: string;
  let targetKind: string;
  let targetId: string;
  let visitorKey: string;
  try {
    const body = await request.json();
    sparkId = String(body.sparkId ?? "");
    targetKind = String(body.targetKind ?? "");
    targetId = String(body.targetId ?? "");
    visitorKey = String(body.visitorKey ?? "");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!/^\d+$/.test(sparkId) || !targetKind || !targetId || !visitorKey) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { data: sharer } = await admin.from("profiles").select("id").eq("spark_id", Number(sparkId)).maybeSingle();
  if (!sharer) return NextResponse.json({ ok: true }); // unknown Spark ID -- nothing to record, not an error

  // Best-effort self-share skip: if the visitor happens to be signed in
  // on this browser and it's their own link, don't count it. Someone
  // signed out (the common case for "clicked a link from X/Facebook")
  // can't be told apart from a stranger, which is exactly why this can
  // never be more than a plain visit counter.
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    const { data: userData } = await admin.auth.getUser(token);
    if (userData.user?.id === sharer.id) return NextResponse.json({ ok: true });
  }

  await recordShareVisit(admin, sharer.id, targetKind, targetId, visitorKey);
  return NextResponse.json({ ok: true });
}
