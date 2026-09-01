"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { WidgetSkin } from "@/lib/widgetSkins";

// Admin dashboard, part 1 -- managing the widget skin catalog (see
// lib/widgetSkins.ts and supabase/schema.sql's widget_skins table). This
// is the payoff of moving skins into the database: adding skin #17 from
// here is a form submission, not a code change and a deploy.
//
// The real security boundary is the RLS policy on widget_skins ("Admins
// manage widget skins" -- only rows where auth.uid() is a profile with
// is_admin = true can insert/update/delete). The is_admin check in this
// component is only a UX nicety -- it decides what to *show*, not what's
// allowed; a non-admin who somehow loaded this page couldn't actually
// write anything, because Supabase itself would refuse it.

type SkinRow = WidgetSkin & { sortOrder: number };

const VAR_FIELDS: { key: keyof WidgetSkin["vars"]; label: string; placeholder: string }[] = [
  { key: "--widget-background", label: "Background", placeholder: "#121a2c" },
  { key: "--widget-panel", label: "Panel", placeholder: "#18233a" },
  { key: "--widget-border", label: "Border", placeholder: "#313f5e" },
  { key: "--widget-radius", label: "Corner radius", placeholder: "14px" },
  { key: "--widget-shadow", label: "Shadow", placeholder: "0 4px 18px rgba(0,0,0,0.28)" },
  { key: "--widget-header-bg", label: "Header background", placeholder: "#121a2c or a gradient" },
  { key: "--widget-header-text", label: "Header text", placeholder: "#8b93ab" },
  { key: "--widget-text", label: "Text", placeholder: "#ece7dc" },
  { key: "--widget-text-dim", label: "Text (dim)", placeholder: "#9aa3b8" },
  { key: "--widget-text-faint", label: "Text (faint)", placeholder: "#5c6684" },
  { key: "--widget-accent", label: "Accent", placeholder: "#c9a15a" },
  { key: "--widget-rose", label: "Rose", placeholder: "#c9576a" },
];

function blankForm(nextSortOrder: number): SkinRow {
  return {
    key: "",
    name: "",
    description: "",
    headerLabel: "SIGNAL",
    kind: "palette",
    unlockId: undefined,
    imageUrl: undefined,
    sortOrder: nextSortOrder,
    vars: {
      "--widget-background": "#121a2c",
      "--widget-panel": "#18233a",
      "--widget-border": "#313f5e",
      "--widget-radius": "14px",
      "--widget-shadow": "0 4px 18px rgba(0,0,0,0.28)",
      "--widget-header-bg": "#121a2c",
      "--widget-header-text": "#8b93ab",
      "--widget-text": "#ece7dc",
      "--widget-text-dim": "#9aa3b8",
      "--widget-text-faint": "#5c6684",
      "--widget-accent": "#c9a15a",
      "--widget-rose": "#c9576a",
    },
  };
}

export default function AdminSkinsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [skins, setSkins] = useState<SkinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SkinRow | null>(null);
  const [editingExistingKey, setEditingExistingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function refresh() {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("widget_skins")
      .select("key, name, description, header_label, kind, unlock_id, image_url, sort_order, vars")
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (fetchError || !data) {
      setError("Couldn't load the skin catalog.");
      return;
    }
    setSkins(
      data.map((row) => ({
        key: row.key,
        name: row.name,
        description: row.description,
        headerLabel: row.header_label,
        kind: row.kind === "artwork" ? "artwork" : "palette",
        unlockId: row.unlock_id ?? undefined,
        imageUrl: row.image_url ?? undefined,
        sortOrder: row.sort_order,
        vars: row.vars,
      }))
    );
  }

  function startAdd() {
    const nextSort = skins.length > 0 ? Math.max(...skins.map((s) => s.sortOrder)) + 1 : 0;
    setForm(blankForm(nextSort));
    setEditingExistingKey(null);
    setError(null);
  }

  function startEdit(skin: SkinRow) {
    setForm({ ...skin, vars: { ...skin.vars } });
    setEditingExistingKey(skin.key);
    setError(null);
  }

  function cancelForm() {
    setForm(null);
    setEditingExistingKey(null);
    setError(null);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const key = form.key.trim();
    const name = form.name.trim();
    if (!key || !name) {
      setError("Key and name are both required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      key,
      name,
      description: form.description.trim(),
      header_label: form.headerLabel.trim() || "SIGNAL",
      kind: form.kind,
      unlock_id: form.unlockId?.trim() || null,
      image_url: form.kind === "artwork" ? form.imageUrl?.trim() || null : null,
      sort_order: form.sortOrder,
      vars: form.vars,
    };

    const { error: saveError } = editingExistingKey
      ? await supabase.from("widget_skins").update(payload).eq("key", editingExistingKey)
      : await supabase.from("widget_skins").insert(payload);

    setSaving(false);
    if (saveError) {
      setError(saveError.message || "Couldn't save that skin.");
      return;
    }
    setForm(null);
    setEditingExistingKey(null);
    await refresh();
  }

  async function deleteSkin(key: string) {
    if (!window.confirm(`Delete the "${key}" skin? This can't be undone.`)) return;
    const { error: deleteError } = await supabase.from("widget_skins").delete().eq("key", key);
    if (deleteError) {
      setError(deleteError.message || "Couldn't delete that skin.");
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
          Widget Skins
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--ink-dim)",
            maxWidth: "60ch",
            margin: "0 0 28px",
          }}
        >
          Every skin here is available to the audio player and the Hub Capsule (unless it has an
          Unlock ID, in which case it&rsquo;s only offered once that&rsquo;s been earned -- see
          lib/evolution.ts). Changes appear for visitors on their next page load.
        </p>

        {error && (
          <p style={{ color: "var(--rose)", fontSize: "0.85rem", marginBottom: "16px" }}>{error}</p>
        )}

        {!form && (
          <button
            type="button"
            onClick={startAdd}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "1px solid var(--gold)",
              background: "none",
              color: "var(--gold)",
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              marginBottom: "24px",
            }}
          >
            + Add a skin
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
              marginBottom: "28px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <label style={fieldLabelStyle}>
                Key (id, lowercase-with-dashes)
                <input
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  disabled={Boolean(editingExistingKey)}
                  placeholder="ocean-deep"
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabelStyle}>
                Name
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ocean Deep"
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabelStyle}>
                Header label
                <input
                  value={form.headerLabel}
                  onChange={(e) => setForm({ ...form, headerLabel: e.target.value })}
                  placeholder="SIGNAL"
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabelStyle}>
                Unlock ID (leave blank to make it free)
                <input
                  value={form.unlockId ?? ""}
                  onChange={(e) => setForm({ ...form, unlockId: e.target.value || undefined })}
                  placeholder="widget-skin-aurora"
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabelStyle}>
                Kind
                <select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value === "artwork" ? "artwork" : "palette" })}
                  style={inputStyle}
                >
                  <option value="palette">Palette (colors only)</option>
                  <option value="artwork">Artwork (a real image)</option>
                </select>
              </label>
              {form.kind === "artwork" && (
                <label style={{ ...fieldLabelStyle, flex: "1 1 100%" }}>
                  Image URL (a path under /public, e.g. /widget-skin-art/ocean-current.jpg)
                  <input
                    value={form.imageUrl ?? ""}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value || undefined })}
                    placeholder="/widget-skin-art/ocean-current.jpg"
                    style={inputStyle}
                  />
                </label>
              )}
              <label style={fieldLabelStyle}>
                Sort order
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={{ ...fieldLabelStyle, gridColumn: "1 / -1" }}>
              Description
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="A short line describing the mood."
                style={inputStyle}
              />
            </label>

            {VAR_FIELDS.map((field) => (
              <label key={field.key} style={fieldLabelStyle}>
                {field.label}
                <input
                  value={form.vars[field.key]}
                  onChange={(e) =>
                    setForm({ ...form, vars: { ...form.vars, [field.key]: e.target.value } })
                  }
                  placeholder={field.placeholder}
                  style={inputStyle}
                />
              </label>
            ))}

            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "16px", marginTop: "6px" }}>
              <SwatchPreview vars={form.vars} name={form.name || "Preview"} imageUrl={form.kind === "artwork" ? form.imageUrl : undefined} />
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit" disabled={saving} style={primaryButtonStyle}>
                  {saving ? "Saving..." : editingExistingKey ? "Save changes" : "Create skin"}
                </button>
                <button type="button" onClick={cancelForm} disabled={saving} style={secondaryButtonStyle}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {loading ? (
          <p style={{ color: "var(--ink-faint, #5c6684)" }}>Loading&hellip;</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
            {skins.map((skin) => (
              <div
                key={skin.key}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "14px",
                }}
              >
                <SwatchPreview vars={skin.vars} name={skin.name} imageUrl={skin.kind === "artwork" ? skin.imageUrl : undefined} />
                <p style={{ margin: "10px 0 2px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-faint, #5c6684)" }}>
                  {skin.key}
                  {skin.unlockId && <> &middot; locked</>}
                </p>
                <p style={{ margin: "0 0 10px", fontSize: "0.82rem", color: "var(--ink-dim)" }}>{skin.description}</p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" onClick={() => startEdit(skin)} style={secondaryButtonStyle}>
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteSkin(skin.key)} style={dangerButtonStyle}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function SwatchPreview({
  vars,
  name,
  imageUrl,
}: {
  vars: WidgetSkin["vars"];
  name: string;
  imageUrl?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <span
        aria-hidden="true"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          display: "block",
          background: imageUrl ? `url(${imageUrl}) center/cover no-repeat` : vars["--widget-panel"],
          border: `2px solid ${vars["--widget-accent"]}`,
          boxShadow: `0 0 8px ${vars["--widget-accent"]}88`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.9rem" }}>{name}</span>
    </div>
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
