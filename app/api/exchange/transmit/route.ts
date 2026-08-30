import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { WORLD_ISSUES } from "@/lib/worldIssues";
import { getStanding } from "@/lib/standing";

// The Exchange -- score a submitted link's real-world impact and award
// Heartbeats (the `xp` column) for it. This is the ONE place a
// transmission gets written, on purpose: exchange_transmissions has no
// public insert policy (see schema.sql), and the Heartbeats award is
// computed here, server-side, from an actual score -- never trusted
// from the client. Uses the service-role client throughout.
//
// Requires ANTHROPIC_API_KEY to be set for real scoring; falls back to
// a small flat award with an honest note if it's missing or the call
// fails, so a submission never just breaks.

const DAILY_HEARTBEATS_CAP = 200; // real, but meant to take several strong links in one day to hit
const DAILY_COUNT_CAP = 8; // separate cap on attempts -- protects against spam and runaway API cost
const MAX_HEARTBEATS_PER_TRANSMISSION = 60; // only a perfect (100) impact score earns this much

function heartbeatsForScore(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  return Math.round((clamped / 100) * MAX_HEARTBEATS_PER_TRANSMISSION);
}

function extractMeta(html: string): { title: string | null; description: string | null } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  const title = (ogTitleMatch?.[1] || titleMatch?.[1] || "").trim() || null;
  const description = (ogDescMatch?.[1] || "").trim() || null;
  return { title, description };
}

interface ScoreResult {
  issueKey: string | null;
  impactScore: number;
  reasoning: string;
}

async function scoreTransmission(input: {
  url: string;
  title: string | null;
  description: string | null;
}): Promise<ScoreResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      issueKey: null,
      impactScore: 20,
      reasoning: "Scored automatically -- real-impact scoring isn't configured yet.",
    };
  }

  const issuesList = WORLD_ISSUES.map((i) => `- ${i.key}: ${i.label} -- ${i.description}`).join("\n");
  const system = `You score links submitted to Same Heart's Exchange, a community feature where people share content that helps build a better world. Weigh each submission against this fixed list of global issues:
${issuesList}

Score honestly and conservatively -- this determines a real reward, so don't inflate it. Most links deserve a modest score (20-50). Reserve 80+ for content that clearly and substantively engages with one of these issues: real reporting, credible data, meaningful analysis, or a genuine call to constructive action. Score low (0-20) for pure entertainment, spam, or content unrelated to any of these issues. Only use "none" for issue_key if nothing on the list applies at all.`;

  const userContent = `URL: ${input.url}\nTitle: ${input.title ?? "(unknown)"}\nDescription: ${input.description ?? "(unknown)"}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Verify this model ID is still current at https://docs.claude.com
        // before relying on it long-term -- fast-moving API, and this
        // code degrades gracefully (see the catch below) if it's wrong.
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system,
        messages: [{ role: "user", content: userContent }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                issue_key: {
                  type: "string",
                  enum: [...WORLD_ISSUES.map((i) => i.key), "none"],
                },
                impact_score: { type: "integer" },
                reasoning: { type: "string" },
              },
              required: ["issue_key", "impact_score", "reasoning"],
              additionalProperties: false,
            },
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Claude API responded ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const text = json.content?.[0]?.text;
    if (!text) throw new Error("Claude response had no text content");

    const parsed = JSON.parse(text);
    const impactScore = Math.max(0, Math.min(100, Number(parsed.impact_score) || 0));
    const issueKey = parsed.issue_key === "none" ? null : parsed.issue_key ?? null;
    const reasoning = String(parsed.reasoning ?? "").slice(0, 300);
    return { issueKey, impactScore, reasoning };
  } catch (err) {
    console.error("Exchange scoring failed:", err instanceof Error ? err.message : err);
    return {
      issueKey: null,
      impactScore: 15,
      reasoning: "Scoring didn't go through this time -- a small default award instead.",
    };
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Sign in to transmit a link." }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 });
  }
  const profileId = userData.user.id;

  let url: string;
  try {
    const body = await request.json();
    url = String(body.url || "").trim();
  } catch {
    return NextResponse.json({ error: "Couldn't read that request." }, { status: 400 });
  }

  if (!/^https?:\/\/.+/i.test(url) || url.length > 2000) {
    return NextResponse.json({ error: "That doesn't look like a real link." }, { status: 400 });
  }

  let domain: string;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return NextResponse.json({ error: "That doesn't look like a real link." }, { status: 400 });
  }

  // Daily limits: a hard cap on attempts (protects against spam and
  // runaway scoring-API cost) and a separate Heartbeats ceiling that's
  // real but deliberately hard to actually reach in one day.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { data: todaysRows, error: todaysError } = await admin
    .from("exchange_transmissions")
    .select("heartbeats_awarded")
    .eq("profile_id", profileId)
    .gte("created_at", startOfDay.toISOString());

  if (todaysError) {
    console.error("Exchange daily lookup failed:", todaysError.message);
  }
  const todaysCount = todaysRows?.length ?? 0;
  const todaysHeartbeats = (todaysRows ?? []).reduce(
    (sum, r) => sum + (r.heartbeats_awarded ?? 0),
    0
  );

  if (todaysCount >= DAILY_COUNT_CAP) {
    return NextResponse.json(
      { error: `You've transmitted ${DAILY_COUNT_CAP} links today -- come back tomorrow for more.` },
      { status: 429 }
    );
  }

  // Best-effort fetch of the target page's own title/description. A lot
  // of sites (X especially) block or limit server-side fetches -- a
  // failure here doesn't block the transmission, it just scores with
  // less context.
  let title: string | null = null;
  let description: string | null = null;
  try {
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SameHeartExchange/1.0)" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    const html = (await pageRes.text()).slice(0, 30000);
    const meta = extractMeta(html);
    title = meta.title;
    description = meta.description;
  } catch (err) {
    console.error("Exchange target fetch failed:", err instanceof Error ? err.message : err);
  }

  const scored = await scoreTransmission({ url, title, description });
  const rawAward = heartbeatsForScore(scored.impactScore);
  const remaining = Math.max(0, DAILY_HEARTBEATS_CAP - todaysHeartbeats);
  const heartbeatsAwarded = Math.min(rawAward, remaining);
  const dailyCapReached = heartbeatsAwarded < rawAward;

  const { data: transmission, error: insertError } = await admin
    .from("exchange_transmissions")
    .insert({
      profile_id: profileId,
      url,
      title,
      domain,
      issue_key: scored.issueKey,
      impact_score: scored.impactScore,
      reasoning: scored.reasoning,
      heartbeats_awarded: heartbeatsAwarded,
    })
    .select("*")
    .single();

  if (insertError || !transmission) {
    console.error("Exchange transmission insert failed:", insertError?.message);
    return NextResponse.json({ error: "Couldn't record that transmission -- try again." }, { status: 500 });
  }

  const { data: profileRow, error: profileFetchError } = await admin
    .from("profiles")
    .select("xp")
    .eq("id", profileId)
    .single();

  const currentXp = profileFetchError || !profileRow ? 0 : profileRow.xp ?? 0;
  const newXp = currentXp + heartbeatsAwarded;
  const newStanding = getStanding(newXp);

  const { error: updateError } = await admin
    .from("profiles")
    .update({ xp: newXp, standing: newStanding })
    .eq("id", profileId);
  if (updateError) {
    console.error("Exchange profile update failed:", updateError.message);
  }

  const issue = WORLD_ISSUES.find((i) => i.key === scored.issueKey);
  await admin.from("log_entries").insert({
    profile_id: profileId,
    description: title
      ? `Transmitted "${title}" -- scored ${scored.impactScore}/100${issue ? ` on ${issue.label}` : ""}.`
      : `Transmitted a link -- scored ${scored.impactScore}/100${issue ? ` on ${issue.label}` : ""}.`,
    category: "humanitarian",
    xp_awarded: heartbeatsAwarded,
  });

  return NextResponse.json({
    transmission,
    heartbeatsAwarded,
    newXp,
    newStanding,
    dailyCapReached,
  });
}
