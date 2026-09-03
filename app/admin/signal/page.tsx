"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// The Yellow Heart String's door, part 2 -- managing the feed_sources
// catalog (see supabase/schema.sql and lib/rssFeeds.ts). Same shape and
// same reasoning as /admin/skins: adding or retiring a Signal source
// here is a form submission and takes effect on the next hourly cron
// run (app/api/cron/fetch-news/route.ts), not a code change and a
// deploy.
//
// The real security boundary is the RLS policy on feed_sources ("Admins
// manage feed sources" -- only rows where auth.uid() is a profile with
// is_admin = true can insert/update/delete). The is_admin check in this
// component is only a UX nicety -- it decides what to *show*, not what's
// allowed; a non-admin who somehow loaded this page couldn't actually
// write anything, because Supabase itself would refuse it.

interface FeedSourceRow {
  id: string;
  name: string;
  url: string;
  topic: string;
  active: boolean;
  sortOrder: number;
}

// The other half of the Yellow Heart String's door (see app/signal/page.tsx
// and app/api/signal/suggest|decide|suggestions). A holder proposing a
// source lands here first, as a pending row -- approving one inserts it
// straight into feed_sources above; declining just closes it out. Read
// through app/api/signal/suggestions (service role) rather than a direct
// client select, since it needs to join in the suggester's display name
// and profiles isn't publicly readable.
interface SuggestionRow {
  id: string;
  profileId: string;
  displayName: string | null;
  name: string;
  url: string;
  topic: string;
  note: string | null;
  status: "pending" | "approved" | "declined";
  createdAt: string;
}

function blankForm(nextSortOrder: number): Omit<FeedSourceRow, "id"> {
  return {
    name: "",
    url: "",
    topic: "world",
    active: true,
    sortOrder: nextSortOrder,
  };
}

export default function AdminSignalPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sources, setSources] = useState<FeedSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Omit<FeedSourceRow, "id"> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();
      setIsAdmin(Boolean(profileRow?.is_admin));
      setChecking(false);
      if (profileRow?.is_admin) {
        await refresh();
        await refreshSuggestions();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function refreshSuggestions() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    try {
      const res = await fetch("/api/signal/suggestions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSuggestionsError(json.error || "Couldn't load suggestions.");
        return;
      }
      setSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
    } catch {
      setSuggestionsError("Couldn't reach the server.");
    }
  }

  async function decideSuggestion(suggestionId: string, decision: "approved" | "declined") {
    setDecidingId(suggestionId);
    setSuggestionsError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setDecidingId(null);
      return;
    }
    try {
      const res = await fetch("/api/signal/decide", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, decision }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSuggestionsError(json.error || "Couldn't save that decision.");
        setDecidingId(null);
        return;
      }
      await refreshSuggestions();
      if (decision === "approved") await refresh();
    } finally {
      setDecidingId(null);
    }
  }

  async function refresh() {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("feed_sources")
      .select("id, name, url, topic, active, sort_order")
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (fetchError || !data) {
      setError("Couldn't load the Signal source list.");
      return;
    }
    setSources(
      data.map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        topic: row.topic,
        active: row.active,
        sortOrder: row.sort_order,
      }))
    );
  }

  function startAdd() {
    const nextSort = sources.length > 0 ? Math.max(...sources.map((s) => s.sortOrder)) + 1 : 0;
    setForm(blankForm(nextSort));
    setEditingId(null);
    setError(null);
  }

  function startEdit(source: FeedSourceRow) {
    setForm({ name: source.name, url: source.url, topic: source.topic, active: source.active, sortOrder: source.sortOrder });
    setEditingId(source.id);
    setError(null);
  }

  function cancelForm() {
    setForm(null);
    setEditingId(null);
    setError(null);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const name = form.name.trim();
    const url = form.url.trim();
    if (!name || !url) {
      setError("Name and URL are both required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      name,
      url,
      topic: form.topic.trim() || "world",
      active: form.active,
      sort_order: form.sortOrder,
    };

    const { error: saveError } = editingId
      ? await supabase.from("feed_sources").update(payload).eq("id", editingId)
      : await supabase.from("feed_sources").insert(payload);

    setSaving(false);
    if (saveError) {
      setError(saveError.message || "Couldn't save that source.");
      return;
    }
    setForm(null);
    setEditingId(null);
    await refresh();
  }

  async function toggleActive(source: FeedSourceRow) {
    const { error: toggleError } = await supabase
      .from("feed_sources")
      .update({ active: !source.active })
      .eq("id", source.id);
    if (toggleError) {
      setError(toggleError.message || "Couldn't update that source.");
      return;
    }
    await refresh();
  }

  async function deleteSource(source: FeedSourceRow) {
    if (!window.confirm(`Delete "${source.name}"? This can't be undone.`)) return;
    const { error: deleteError } = await supabase.from("feed_sources").delete().eq("id", source.id);
    if (deleteError) {
      setError(deleteError.message || "Couldn't delete that source.");
      return;
    }
    await refresh();
  }

  if (checking) return null;

  if (!isAdmin) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--void)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-body)",
        }}
      >
        <p>You don&rsquo;t have access to this page.</p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        <Link
          href="/admin"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          &larr; Admin
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.7rem",
            margin: "20px 0 6px",
          }}
        >
          Signal Sources
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--ink-dim)",
            maxWidth: "60ch",
            margin: "0 0 28px",
          }}
        >
          Every active source here is fetched once an hour by the Signal cron job. Turning a
          source off (or deleting it) stops new articles from it; nothing already shown to
          anyone disappears. Changes take effect on the next hourly run -- see
          app/api/cron/fetch-news/route.ts.
        </p>

        {error && (
          <p style={{ color: "var(--rose)", fontSize: "0.85rem", marginBottom: "16px" }}>{error}</p>
        )}

        {/* Yellow Heart String's door, the review side -- see
            app/signal/page.tsx (where these come from) and
            app/api/signal/decide (the only place one becomes a real
            feed_sources row). Only ever shows pending ones; approved
            and declined suggestions just quietly drop out of this list
            once decided, same as the applications list in
            /admin/monetization. */}
        {suggestions.filter((s) => s.status === "pending").length > 0 && (
          <div style={{ marginBottom: "28px" }}>
            <h2
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-faint, #5c6684)",
                margin: "0 0 10px",
              }}
            >
              Suggested by members
            </h2>
            {suggestionsError && (
              <p style={{ color: "var(--rose)", fontSize: "0.85rem", marginBottom: "10px" }}>{suggestionsError}</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {suggestions
                .filter((s) => s.status === "pending")
                .map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: "var(--panel)",
                      border: "1px solid var(--gold)",
                      borderRadius: "12px",
                      padding: "14px 16px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: "0 0 2px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem" }}>
                          {s.name}
                        </p>
                        <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-faint, #5c6684)", wordBreak: "break-all" }}>
                          {s.topic} &middot; {s.url}
                        </p>
                        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-faint, #5c6684)" }}>
                          Suggested by {s.displayName || "a member"}
                        </p>
                        {s.note && (
                          <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--ink-dim)", fontStyle: "italic" }}>
                            &ldquo;{s.note}&rdquo;
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => decideSuggestion(s.id, "approved")}
                          disabled={decidingId === s.id}
                          style={primaryButtonStyle}
                        >
                          {decidingId === s.id ? "..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => decideSuggestion(s.id, "declined")}
                          disabled={decidingId === s.id}
                          style={dangerButtonStyle}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {!form && (
          <button type="button" onClick={startAdd} style={primaryOutlineButtonStyle}>
            + Add a source
          </button>
        )}

        {form && (
          <form
            onSubmit={saveForm}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "22px",
              margin: "24px 0 28px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <label style={fieldLabelStyle}>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Reuters"
                style={inputStyle}
              />
            </label>
            <label style={fieldLabelStyle}>
              Topic
              <select
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                style={inputStyle}
              >
                <option value="world">World</option>
                <option value="solutions">Solutions</option>
              </select>
            </label>
            <label style={{ ...fieldLabelStyle, gridColumn: "1 / -1" }}>
              Feed URL (RSS 2.0)
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/rss.xml"
                style={inputStyle}
              />
            </label>
            <label style={fieldLabelStyle}>
              Sort order
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                style={inputStyle}
              />
            </label>
            <label style={{ ...fieldLabelStyle, flexDirection: "row", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>

            <div style={{ gridColumn: "1 / -1", display: "flex", gap: "10px", marginTop: "6px" }}>
              <button type="submit" disabled={saving} style={primaryButtonStyle}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Add source"}
              </button>
              <button type="button" onClick={cancelForm} disabled={saving} style={secondaryButtonStyle}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p style={{ color: "var(--ink-faint, #5c6684)", marginTop: "20px" }}>Loading&hellip;</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "24px" }}>
            {sources.map((source) => (
              <div
                key={source.id}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  opacity: source.active ? 1 : 0.55,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: "0 0 2px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem" }}>
                    {source.name}
                    {!source.active && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--ink-faint, #5c6684)", marginLeft: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        off
                      </span>
                    )}
                  </p>
                  <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-faint, #5c6684)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {source.topic} &middot; {source.url}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <button type="button" onClick={() => toggleActive(source)} style={secondaryButtonStyle}>
                    {source.active ? "Turn off" : "Turn on"}
                  </button>
                  <button type="button" onClick={() => startEdit(source)} style={secondaryButtonStyle}>
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteSource(source)} style={dangerButtonStyle}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {sources.length === 0 && (
              <p style={{ color: "var(--ink-faint, #5c6684)" }}>No sources yet -- add one above.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ink-faint, #5c6684)",
  flex: "1 1 200px",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--void)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: "10px",
  border: "none",
  background: "var(--gold)",
  color: "var(--void)",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "0.8rem",
  cursor: "pointer",
};

const primaryOutlineButtonStyle: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px solid var(--gold)",
  background: "none",
  color: "var(--gold)",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "none",
  color: "var(--ink-dim)",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "0.8rem",
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: "10px",
  border: "1px solid var(--rose)",
  background: "none",
  color: "var(--rose)",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "0.8rem",
  cursor: "pointer",
};
