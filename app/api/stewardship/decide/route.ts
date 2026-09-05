import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Stewardship's review queue, part 2 -- the only place a flag ever
// moves out of "pending." commons_flags locks status/resolved_at/
// resolved_by away from the "authenticated" role entirely (see
// supabase/schema.sql's column-level revoke), so this route -- running
// as the service role -- is the only path that can ever set them.
// Re-checks is_admin from the database itself rather than trusting
// anything the client claims, same as every other admin-only write on
// this site (app/api/monetization/decide is the direct template).

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
  const flagId = typeof body.flagId === "string" ? body.flagId : null;
  const decision = body.decision === "resolved" || body.decision === "dismissed" ? body.decision : null;

  if (!flagId || !decision) {
    return NextResponse.json({ error: "Missing flagId or decision." }, { status: 400 });
  }

  const { error: updateError } = await admin
    .from("commons_flags")
    .update({ status: decision, resolved_at: new Date().toISOString(), resolved_by: adminId })
    .eq("id", flagId);

  if (updateError) {
    console.error("Stewardship flag decision failed:", updateError.message);
    return NextResponse.json({ error: "Couldn't save that decision." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
