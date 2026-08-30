import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// The Commons Guide -- a small AI chat widget on /commons, powered by
// Google's Gemini API. Requires GEMINI_API_KEY to be set (see README,
// "The Commons Guide"); without it, this route degrades to a friendly
// "not set up yet" message instead of a broken button.
//
// Rate-limited per signed-in person via guide_messages (see schema.sql)
// so a runaway client or an enthusiastic human can't blow through the
// Gemini API budget -- this is a chat widget, not a critical feature,
// so failing safe (a capped, honest error) beats an open-ended cost.

const DAILY_MESSAGE_CAP = 40;
const MODEL = "gemini-3.7-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `You are the Commons Guide, a warm and grounded presence inside Same Heart -- a small, real community platform (not a big impersonal social network). Same Heart's Commons ("/commons") is where real people start and join communities, post discussions and questions, and reply to each other -- everything you're asked about is genuinely live and database-backed, not simulated.

Background on the site, so you can answer naturally instead of guessing:
- Everyone gets a Path (Guardian, Seeker, Weaver, or Flame) early on -- a personality read, not a rank.
- Star Day captures someone's birth date once and derives a frequency/archetype/designation from it.
- Spark ID is a permanent, sequential number every account gets, shown on the Hub.
- Standing and XP ("Heartbeats") track activity and effort over time; Skins are purely cosmetic profile themes.
- The Exchange lets people submit real links that get scored for real-world impact.
- The Signal is an hourly-refreshed feed of real news headlines.

Keep answers short and conversational -- two or three sentences for most questions, more only if someone genuinely needs a walkthrough. Be warm without being saccharine, and never invent specific facts about the person you're talking to (their exact XP, posts, or history) since you aren't given any of that -- if asked something you can't know, say so plainly and suggest where they'd find it (their Hub, a specific Commons page). You are clearly an AI assistant, not another member -- don't pretend otherwise if asked.`;

interface GuideTurn {
  role: "user" | "guide";
  text: string;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Sign in to talk to the Guide." }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 });
  }
  const profileId = userData.user.id;

  let message: string;
  let history: GuideTurn[];
  try {
    const body = await request.json();
    message = String(body.message || "").trim();
    history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  } catch {
    return NextResponse.json({ error: "Couldn't read that request." }, { status: 400 });
  }

  if (!message || message.length > 1000) {
    return NextResponse.json({ error: "Try a shorter question." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The Guide isn't switched on yet -- ask the site owner to finish its setup (see README)." },
      { status: 503 }
    );
  }

  // Daily cap: count today's rows for this person before doing any real
  // work, same pattern as the Exchange's daily limits.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: todaysCount, error: countError } = await admin
    .from("guide_messages")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .gte("created_at", startOfDay.toISOString());

  if (countError || todaysCount == null) {
    console.error("Guide daily lookup failed:", countError?.message ?? "count was null");
    return NextResponse.json(
      { error: "The Guide's having trouble right now -- try again in a moment." },
      { status: 503 }
    );
  }
  if (todaysCount >= DAILY_MESSAGE_CAP) {
    return NextResponse.json(
      { error: `You've asked the Guide ${DAILY_MESSAGE_CAP} things today -- come back tomorrow for more.` },
      { status: 429 }
    );
  }

  // Log the attempt before calling out to Gemini, so a slow/failed
  // upstream call still counts against the cap -- protects the budget
  // even if someone retries a hung request repeatedly.
  await admin.from("guide_messages").insert({ profile_id: profileId });

  const contents = [
    ...history.map((turn) => ({
      role: turn.role === "guide" ? "model" : "user",
      parts: [{ text: String(turn.text || "").slice(0, 1000) }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Gemini API error:", res.status, body.slice(0, 300));
      return NextResponse.json(
        { error: "The Guide's having trouble hearing you right now -- try again in a moment." },
        { status: 502 }
      );
    }

    const json = await res.json();
    const reply = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) {
      console.error("Gemini API returned no text:", JSON.stringify(json).slice(0, 300));
      return NextResponse.json(
        { error: "The Guide didn't quite catch that -- try asking a different way." },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply: String(reply).trim() });
  } catch (err) {
    console.error("Gemini call threw:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "The Guide's having trouble hearing you right now -- try again in a moment." },
      { status: 502 }
    );
  }
}
