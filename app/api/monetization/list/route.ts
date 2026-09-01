import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Monetization gate, part 5 -- the admin queue's read side. profiles'
// RLS only ever lets someone read their own row (see supabase/schema.sql
// -- there's deliberately no "admins can read every profile" policy),
// so /admin/monetization can't join applicant details client-side the
// way /admin/skins reads widget_skins directly -- widget_skins is
// public-readable, profiles isn't. This route re-checks is_admin itself
// (same as app/api/monetization/decide) and does the join server-side
// with the service role, which is allowed to see every row.

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

  const { data: applications, error: applicationsError } = await admin
    .from("monetization_applications")
    .select("id, profile_id, status, applied_at, decided_at")
    .order("applied_at", { ascending: true });

  if (applicationsError) {
    console.error("Monetization list failed:", applicationsError.message);
    return NextResponse.json({ error: "Couldn't load applications." }, { status: 503 });
  }

  const profileIds = Array.from(new Set((applications ?? []).map((a) => a.profile_id)));
  const profilesById: Record<string, { display_name: string | null; designation: string | null; standing: string | null; spark_id: number | null }> = {};

  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, display_name, designation, standing, spark_id")
      .in("id", profileIds);

    if (profilesError) {
      console.error("Monetization applicant profile lookup failed:", profilesError.message);
      return NextResponse.json({ error: "Couldn't load applicant details." }, { status: 503 });
    }
    for (const p of profiles ?? []) {
      profilesById[p.id] = {
        display_name: p.display_name,
        designation: p.designation,
        standing: p.standing,
        spark_id: p.spark_id,
      };
    }
  }

  const rows = (applications ?? []).map((a) => ({
    id: a.id,
    profileId: a.profile_id,
    status: a.status,
    appliedAt: a.applied_at,
    decidedAt: a.decided_at,
    displayName: profilesById[a.profile_id]?.display_name ?? null,
    designation: profilesById[a.profile_id]?.designation ?? null,
    standing: profilesById[a.profile_id]?.standing ?? null,
    sparkId: profilesById[a.profile_id]?.spark_id ?? null,
  }));

  return NextResponse.json({ applications: rows });
}
