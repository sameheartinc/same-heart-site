"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import { createCommunity, listCommunities, fetchProfilesByIds, type Community } from "@/lib/commons";
import { listMyKeys } from "@/lib/keys";

const ACCENT = "#c9576a";

// The forums main page -- every community in one place, with a way to
// start a new one. The Commons homepage's "Communities" stat card
// links here (see app/commons/page.tsx); the Commons homepage also
// keeps its own inline Communities section further down the page, so
// nothing that already worked there was removed -- this is a second,
// more direct front door onto the same list (lib/commons.ts's
// listCommunities/createCommunity), for people who just want to browse
// or start a community without scrolling through the rest of the feed.
export default function CommunitiesPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [founderFlair, setFounderFlair] = useState<Set<string>>(new Set());
  const [hasPink, setHasPink] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrivate, setNewPrivate] = useState(false);
  const [newBusy, setNewBusy] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setUserId(userData.user.id);
      const [list, myKeys] = await Promise.all([listCommunities(), listMyKeys()]);
      setHasPink(myKeys.some((k) => k.key_color === "pink"));

      // Magenta's featured-slot door -- see PLAN.md ("a featured
      // rotation slot in the /communities directory"). Static rather
      // than truly rotating for now: a real rotation needs a scheduled
      // job to pick a new one periodically, which is more machinery
      // than this deserves until there are enough Magenta-founded
      // communities for rotation to mean anything. Every one of them
      // gets pinned to the top today; narrowing that to an actual
      // rotating single slot is a small follow-up once it matters.
      const founders = await fetchProfilesByIds(list.map((c) => c.created_by));
      const flair = new Set(
        list.filter((c) => founders[c.created_by]?.has_magenta_string).map((c) => c.id)
      );
      const sorted = [...list].sort((a, b) => Number(flair.has(b.id)) - Number(flair.has(a.id)));
      setFounderFlair(flair);
      setCommunities(sorted);
      setChecking(false);
    })();
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !newName.trim()) return;
    setNewBusy(true);
    setNewError(null);
    try {
      const community = await createCommunity({
        name: newName,
        description: newDesc,
        accent: ACCENT,
        createdBy: userId,
        isPrivate: hasPink && newPrivate,
      });
      setNewName("");
      setNewDesc("");
      setNewPrivate(false);
      setNewOpen(false);
      router.push(`/commons/c/${community.slug}`);
    } catch (err: any) {
      setNewError(
        err?.code === "23505" ? "A community with that name already exists." : "Couldn't create that -- try again."
      );
    } finally {
      setNewBusy(false);
    }
  }

  if (checking) return <PageLoading />;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <Link
          href="/commons"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-display)",
            fontSize: "0.82rem",
            textDecoration: "none",
          }}
        >
          &larr; Back to the Commons
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            margin: "20px 0 6px",
          }}
        >
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.6rem", margin: 0 }}>
            Communities
          </h1>
          <button onClick={() => setNewOpen((v) => !v)} style={newActionStyle}>
            {newOpen ? "Cancel" : "+ Start a community"}
          </button>
        </div>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--ink-dim)", maxWidth: "56ch", margin: "0 0 24px" }}>
          A space inside the Commons built around one shared interest -- anyone can start
          one, and you become its first member the moment you do.
        </p>

        {newOpen && (
          <form onSubmit={handleCreate} style={{ marginBottom: "24px" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Community name"
              required
              style={{ ...inputStyle, marginBottom: "8px" }}
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What's it about?"
              rows={2}
              style={{ ...inputStyle, marginBottom: "8px", resize: "vertical" as const }}
            />
            {hasPink && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  margin: "0 0 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.04em",
                  color: "var(--ink-dim)",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={newPrivate} onChange={(e) => setNewPrivate(e.target.checked)} />
                Make this a private circle -- invite-only, held by your Pink Heart String.
              </label>
            )}
            {newError && <p style={errorStyle}>{newError}</p>}
            <button type="submit" disabled={newBusy} style={submitButtonStyle}>
              {newBusy ? "Creating..." : "Create community"}
            </button>
          </form>
        )}

        {communities.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)" }}>
            No communities yet -- start the first one.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
            {communities.map((c) => (
              <Link
                key={c.id}
                href={`/commons/c/${c.slug}`}
                style={{
                  display: "block",
                  padding: "16px",
                  borderRadius: "14px",
                  background: "var(--panel)",
                  border: `1px solid ${c.accent}44`,
                  textDecoration: "none",
                  color: "var(--ink)",
                }}
              >
                <p style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem" }}>
                  {founderFlair.has(c.id) && (
                    <span title="Founded by a Magenta Heart String holder -- featured" style={{ marginRight: "6px" }}>
                      ★
                    </span>
                  )}
                  {c.name}
                  {c.is_private && (
                    <span
                      style={{
                        marginLeft: "6px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "8px",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--ink-dim)",
                      }}
                    >
                      circle
                    </span>
                  )}
                </p>
                <p style={{ margin: "0 0 10px", fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.8rem", color: "var(--ink-dim)" }}>
                  {c.description || "No description yet."}
                </p>
                <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: c.accent }}>
                  {c.member_count} {c.member_count === 1 ? "member" : "members"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--void)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: "0.88rem",
};

const submitButtonStyle: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: ACCENT,
  color: "#1a0d10",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "0.8rem",
  cursor: "pointer",
};

const newActionStyle: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px solid var(--gold)",
  background: "rgba(184,134,63,0.12)",
  color: "var(--gold)",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "0.8rem",
  letterSpacing: "0.04em",
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  color: "#e0703a",
  fontSize: "0.8rem",
  fontFamily: "var(--font-body)",
  margin: "0 0 8px",
};
