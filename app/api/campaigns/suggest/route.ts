import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const runtime = "nodejs";

const SuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        channel_type: z.enum([
          "news_source",
          "facebook_page",
          "sameheart_community",
          "local_org",
          "other",
        ]),
        channel_name: z.string(),
        url: z.string().nullable(),
        reasoning: z.string(),
        draft_copy: z.string(),
      })
    )
    .min(3)
    .max(6),
});

export type CampaignSuggestion = z.infer<typeof SuggestionSchema>["suggestions"][number];

export async function POST(req: NextRequest) {
  let body: { title?: string; description?: string; location?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { title, description, location } = body;
  if (!title || !description) {
    return NextResponse.json(
      { error: "title and description are required" },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI suggestions are not configured yet (missing ANTHROPIC_API_KEY)" },
      { status: 503 }
    );
  }

  const client = new Anthropic();
  const causeLine = `Cause: ${title}\nDetails: ${description}${
    location ? `\nLocation: ${location}` : ""
  }`;

  // Stage 1: pick up real, current signal via live web search -- this is
  // the "ship's comms picking up a transmission" moment, not a guess from
  // training data. Best-effort -- if search fails, fall through with none.
  let researchNote = "";
  try {
    const research = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 2500,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
      messages: [
        {
          role: "user",
          content:
            "Search for current, real, relevant signal for someone starting this " +
            "grassroots cause: actual recent news articles tied to it (include " +
            "their real URLs), any community groups or initiatives already doing " +
            "similar work nearby, and anything happening in the world right now " +
            "that connects to it. List what you actually find, with real URLs " +
            "where you have them -- if nothing current and specific turns up, say " +
            "so plainly instead of guessing.\n\n" +
            causeLine,
        },
      ],
    });
    researchNote = research.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch {
    researchNote = "";
  }

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4000,
      system:
        "You help someone turn a small act of kindness into real momentum, " +
        "reading it back to them like a transmission their ship's comms just " +
        "picked up. Given a cause someone wants to organize around, suggest 3-5 " +
        "concrete, real things they could act on today: real news articles or " +
        "sources you found via live search (channel_type 'news_source' -- always " +
        "include the real url when you have one, otherwise set url to null and " +
        "say so), the kind of local Facebook Page worth reaching out to " +
        "(channel_type 'facebook_page', url null), how the Same Heart community " +
        "itself could help (channel_type 'sameheart_community', url null), or a " +
        "specific local organization already doing related work (channel_type " +
        "'local_org', include a url if you found their real site). Never invent a " +
        "URL -- only include one you actually found via search this turn. For " +
        "each suggestion, write reasoning specific to their actual cause -- not " +
        "generic -- and a short draft message they could copy and use today, in a " +
        "warm, direct, human voice. Weave in the specific, concrete parts of any " +
        "current context provided below naturally -- don't just restate that " +
        "research was done.",
      messages: [
        {
          role: "user",
          content: researchNote
            ? `${causeLine}\n\nLive signal picked up just now:\n${researchNote}`
            : causeLine,
        },
      ],
      output_config: {
        format: zodOutputFormat(SuggestionSchema),
      },
    });

    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "could not generate suggestions" },
        { status: 502 }
      );
    }

    return NextResponse.json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error: ${error.message}` },
        { status: error.status ?? 502 }
      );
    }
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
