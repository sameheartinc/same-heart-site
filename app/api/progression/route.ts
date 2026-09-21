import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getProgression } from "@/lib/xpEngine";

// Everything about someone's progression in one read -- level, XP,
// live Momentum, active Boost, streak, and Reputation -- all derived
// server-side from data the person can't write directly. See
// lib/xpEngine.ts. Reads only the caller's own numbers.
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

  const progression = await getProgression(admin, userData.user.id);
  if (!progression) {
    return NextResponse.json({ error: "No profile found." }, { status: 404 });
  }
  return NextResponse.json(progression);
}
