import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Monetization gate, part 2 -- the only place a monetization application
// is ever created. Same trust model as every other route in this
// family (app/api/keys/evaluate, app/api/evolution/evaluate): this
// re-derives eligibility itself from profile_unlocks rather than
// believing anything the client claims, and never grants anything --
// it only ever writes a *pending* row. Approval is a completely
// separate, manual step Rob takes in app/api/monetization/decide.
//
// A previously denied applicant can apply again (flips their row back
// to pending); a pending or already-approved applicant just gets their
// current status back, no-op.

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

  const { data: unlock, error: unlockError } = await admin
    .from("profile_unlocks")
    .select("unlock_id")
    .eq("profile_id", profileId)
    .eq("unlock_id", "monetization-eligible")
    .maybeSingle();

  if (unlockError) {
    console.error("Monetization eligibility check failed:", unlockError.message);
    return NextResponse.json({ error: "Couldn't check your eligibility right now." }, { status: 503 });
  }
  if (!unlock) {
    return NextResponse.json({ error: "You're not eligible to apply yet." }, { status: 403 });
  }

  const { data: existing, error: existingError } = await admin
    .from("monetization_applications")
    .select("id, status")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existingError) {
    console.error("Monetization application lookup failed:", existingError.message);
    return NextResponse.json({ error: "Couldn't check your application right now." }, { status: 503 });
  }

  if (existing) {
    if (existing.status === "denied") {
      const { error: updateError } = await admin
        .from("monetization_applications")
        .update({
          status: "pending",
          applied_at: new Date().toISOString(),
          decided_at: null,
          decided_by: null,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Monetization re-application failed:", updateError.message);
        return NextResponse.json({ error: "Couldn't submit your application right now." }, { status: 503 });
      }
      return NextResponse.json({ status: "pending" });
    }
    return NextResponse.json({ status: existing.status });
  }

  const { error: insertError } = await admin
    .from("monetization_applications")
    .insert({ profile_id: profileId, status: "pending" });

  if (insertError) {
    console.error("Monetization application insert failed:", insertError.message);
    return NextResponse.json({ error: "Couldn't submit your application right now." }, { status: 503 });
  }

  return NextResponse.json({ status: "pending" });
}
