import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Monetization gate, part 3 -- the only place an application is ever
// approved or denied. Re-checks is_admin from the database itself
// rather than trusting anything the client claims, same as every other
// admin-only write on this site. Approving here only ever sets
// profiles.monetization_approved -- no payment functionality exists
// yet; that flag is ready for whenever it does.

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
  const applicationId = typeof body.applicationId === "string" ? body.applicationId : null;
  const decision = body.decision === "approved" || body.decision === "denied" ? body.decision : null;

  if (!applicationId || !decision) {
    return NextResponse.json({ error: "Missing applicationId or decision." }, { status: 400 });
  }

  const { data: application, error: fetchError } = await admin
    .from("monetization_applications")
    .select("profile_id")
    .eq("id", applicationId)
    .single();

  if (fetchError || !application) {
    return NextResponse.json({ error: "Couldn't find that application." }, { status: 404 });
  }

  const { error: updateError } = await admin
    .from("monetization_applications")
    .update({ status: decision, decided_at: new Date().toISOString(), decided_by: adminId })
    .eq("id", applicationId);

  if (updateError) {
    console.error("Monetization decision failed:", updateError.message);
    return NextResponse.json({ error: "Couldn't save that decision." }, { status: 503 });
  }

  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({ monetization_approved: decision === "approved" })
    .eq("id", application.profile_id);

  if (profileUpdateError) {
    console.error("Monetization profile flag update failed:", profileUpdateError.message);
  }

  if (decision === "approved") {
    await admin.from("log_entries").insert({
      profile_id: application.profile_id,
      description: "Approved to monetize your account.",
      category: "personal",
      xp_awarded: 0,
    });
  }

  return NextResponse.json({ ok: true });
}
