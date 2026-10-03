"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import { listMyKeys, evaluateKeys, setCommonsAccent, COMMONS_ACCENT_PALETTE, type ProfileKey } from "@/lib/keys";
import { SKINS, getSkin, type SkinKey } from "@/lib/skins";
import { practiceTier, normalizePracticePoints, type PracticePoints } from "@/lib/practices";
import { PATHS, type PathKey } from "@/lib/paths";

const SIGNATURE_MAX = 80;
const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024;

type Profile = {
  display_name: string | null;
  archetype: string | null;
  ship_skin: string | null;
  path_key: string | null;
  commons_accent: string | null;
  hub_background_url: string | null;
  practice_points: unknown;
  voice_signature: string | null;
};

// The "profile builder in Settings" IDEAS.md already names as a gap --
// everything here is real, already-earned, already-written data, just
// never gathered onto one page before now. Four of these five controls
// already existed, scattered across the Hub (Call Sign, Hub Backdrop,
// Commons Accent, Voice Signature) -- their save logic is reused as-is,
// not reinvented, so nothing that already worked changes behavior here.
// Ship Skin is the one genuinely new control: lib/skins.ts has read a
// profile's chosen skin everywhere for a while now, but nothing has ever
// let anyone actually choose one -- this is that picker.
export default function ProfilePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [keys, setKeys] = useState<ProfileKey[]>([]);
  const [practicePoints, setPracticePoints] = useState<PracticePoints | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);

  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);

  const [skinSaving, setSkinSaving] = useState<SkinKey | null>(null);
  const [skinError, setSkinError] = useState<string | null>(null);

  const [accentSaving, setAccentSaving] = useState(false);

  const [editingSignature, setEditingSignature] = useState(false);
  const [signatureDraft, setSignatureDraft] = useState("");
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [signatureSaving, setSignatureSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setUserId(userData.user.id);

      // Same "recheck on arrival" pattern as /wallet and /cards -- a key
      // earned a moment ago elsewhere on the site is already reflected
      // here (e.g. the Blue key unlocking Commons Accent below).
      await evaluateKeys();

      const [{ data: profileRow }, myKeys] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "display_name, archetype, ship_skin, path_key, commons_accent, hub_background_url, practice_points, voice_signature"
          )
          .eq("id", userData.user.id)
          .single(),
        listMyKeys(),
      ]);

      const loadedProfile = profileRow as Profile | null;
      setProfile(loadedProfile);
      setKeys(myKeys);
      setPracticePoints(normalizePracticePoints(loadedProfile?.practice_points));
      setChecking(false);
    })();
  }, [router]);

  // Blue key's door -- see app/api/keys/set-accent/route.ts, the only
  // place this column is ever actually written. This just calls it and
  // reverts the optimistic update if the server says no.
  async function chooseAccent(color: string) {
    if (!userId || !profile || profile.commons_accent === color) return;
    const previous = profile.commons_accent;
    setProfile({ ...profile, commons_accent: color });
    setAccentSaving(true);
    const ok = await setCommonsAccent(color);
    setAccentSaving(false);
    if (!ok) {
      setProfile((p) => (p ? { ...p, commons_accent: previous } : p));
    }
  }

  function startEditName() {
    if (!profile) return;
    setNameDraft(profile.display_name?.trim() || "");
    setNameError(null);
    setEditingName(true);
  }

  function cancelEditName() {
    setEditingName(false);
    setNameError(null);
  }

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !profile || nameSaving) return;
    const trimmed = nameDraft.trim().slice(0, 24);
    if (trimmed.length > 0 && trimmed.length < 2) {
      setNameError("A little longer than that.");
      return;
    }
    const nextValue = trimmed.length > 0 ? trimmed : null;
    if (nextValue === profile.display_name) {
      setEditingName(false);
      return;
    }
    const previous = profile.display_name;
    setNameError(null);
    setProfile({ ...profile, display_name: nextValue });
    setNameSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: nextValue }).eq("id", userId);
    setNameSaving(false);
    if (error) {
      setProfile((p) => (p ? { ...p, display_name: previous } : p));
      setNameError("Couldn't save -- try again.");
      return;
    }
    setEditingName(false);
  }

  async function uploadHubBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId || !profile) return;

    if (!file.type.startsWith("image/")) {
      setBackgroundError("That doesn't look like an image.");
      return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
      setBackgroundError("Keep it under 8MB.");
      return;
    }

    setBackgroundError(null);
    setBackgroundUploading(true);

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("hub-backgrounds").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

    if (uploadError) {
      setBackgroundUploading(false);
      setBackgroundError("Couldn't upload that -- try again.");
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("hub-backgrounds").getPublicUrl(path);
    const nextUrl = publicUrlData.publicUrl;

    const { error: saveError } = await supabase
      .from("profiles")
      .update({ hub_background_url: nextUrl })
      .eq("id", userId);

    setBackgroundUploading(false);
    if (saveError) {
      setBackgroundError("Uploaded, but couldn't save it to your profile -- try again.");
      return;
    }
    setProfile({ ...profile, hub_background_url: nextUrl });
  }

  // Doesn't delete the old file from storage -- just clears the profile
  // column, same "leave it, don't chase cleanup" choice the Hub makes.
  async function removeHubBackground() {
    if (!userId || !profile) return;
    const previous = profile.hub_background_url;
    setProfile({ ...profile, hub_background_url: null });
    const { error } = await supabase.from("profiles").update({ hub_background_url: null }).eq("id", userId);
    if (error) {
      setProfile((p) => (p ? { ...p, hub_background_url: previous } : p));
      setBackgroundError("Couldn't remove it -- try again.");
    }
  }

  // New: nothing in the codebase ever wrote this column before --
  // lib/skins.ts has only ever been read from. Same optimistic-update
  // shape as everything else on this page.
  async function chooseSkin(key: SkinKey) {
    if (!userId || !profile || profile.ship_skin === key || skinSaving) return;
    const previous = profile.ship_skin;
    setSkinError(null);
    setProfile({ ...profile, ship_skin: key });
    setSkinSaving(key);
    const { error } = await supabase.from("profiles").update({ ship_skin: key }).eq("id", userId);
    setSkinSaving(null);
    if (error) {
      setProfile((p) => (p ? { ...p, ship_skin: previous } : p));
      setSkinError("Couldn't save -- try again.");
    }
  }

  function startEditSignature() {
    if (!profile) return;
    setSignatureDraft(profile.voice_signature?.trim() || "");
    setSignatureError(null);
    setEditingSignature(true);
  }

  function cancelEditSignature() {
    setEditingSignature(false);
    setSignatureError(null);
  }

  async function saveVoiceSignature(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !profile || signatureSaving) return;
    const trimmed = signatureDraft.trim().slice(0, SIGNATURE_MAX);
    const nextValue = trimmed.length > 0 ? trimmed : null;
    if (nextValue === profile.voice_signature) {
      setEditingSignature(false);
      return;
    }
    const previous = profile.voice_signature;
    setSignatureError(null);
    setProfile({ ...profile, voice_signature: nextValue });
    setSignatureSaving(true);
    const { error } = await supabase.from("profiles").update({ voice_signature: nextValue }).eq("id", userId);
    setSignatureSaving(false);
    if (error) {
      setProfile((p) => (p ? { ...p, voice_signature: previous } : p));
      setSignatureError("Couldn't save -- try again.");
      return;
    }
    setEditingSignature(false);
  }

  if (checking || !profile) return <PageLoading />;

  const activeSkin = getSkin(profile.ship_skin);
  const backgroundImage = profile.hub_background_url || activeSkin.image;
  const heroBackground = backgroundImage
    ? `linear-gradient(rgba(5,7,13,0.74), rgba(5,7,13,0.74)), url(${backgroundImage}) center / cover fixed no-repeat`
    : "var(--void)";

  const shipName = profile.display_name?.trim() || profile.archetype || "Unnamed Vessel";
  const path = profile.path_key ? PATHS[profile.path_key as PathKey] : null;
  const voiceTier = practiceTier(practicePoints ?? { voice: 0, kinship: 0, guidance: 0, stewardship: 0 }, "voice");
  const voiceUnlocked = voiceTier >= 4;
  const hasBlueKey = keys.some((k) => k.key_color === "blue");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: heroBackground,
        padding: "48px 22px 90px",
        color: "var(--ink)",
        transition: "background 0.5s ease, color 0.5s ease",
        ...(activeSkin.vars as React.CSSProperties),
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <Link
          href="/hub"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-display)",
            fontSize: "0.82rem",
            textDecoration: "none",
          }}
        >
          &larr; Back to the Hub
        </Link>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--gold)",
            margin: "22px 0 8px",
          }}
        >
          Your Profile
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.7rem", margin: "0 0 10px" }}>
          {shipName}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-dim)",
            maxWidth: "56ch",
            margin: "0 0 30px",
          }}
        >
          Everything here is yours to shape -- how you&rsquo;re known, what this place looks like
          when you arrive, and what you&rsquo;ve earned the right to change.
        </p>

        {/* Signal -- read-only. No re-pick UI exists for this anywhere on
            the site; it's assigned once at onboarding and meant to stay
            that way, so this section only ever displays it. */}
        {path && (
          <section className="profile-panel" style={{ marginBottom: "22px", padding: "18px 20px" }}>
            <p
              style={{
                margin: "0 0 6px",
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ink-faint, #5c6684)",
              }}
            >
              Signal &middot; chosen for you when you arrived
            </p>
            <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.15rem", color: path.accent }}>
              {path.name}
            </h2>
            <p style={{ margin: "0 0 6px", fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.88rem", color: "var(--ink-dim)" }}>
              &ldquo;{path.tagline}&rdquo;
            </p>
            <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
              {path.essence}
            </p>
          </section>
        )}

        {/* Call Sign */}
        <section className="profile-panel" style={{ marginBottom: "22px", padding: "18px 20px" }}>
          <p
            style={{
              margin: "0 0 10px",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-faint, #5c6684)",
            }}
          >
            Call Sign
          </p>
          {editingName ? (
            <form onSubmit={saveDisplayName} style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value.slice(0, 24))}
                placeholder={profile.archetype || "Unnamed Vessel"}
                style={{
                  flex: "1 1 200px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--void)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.9rem",
                }}
              />
              <button
                type="submit"
                disabled={nameSaving}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--gold)",
                  background: "var(--gold)",
                  color: "var(--void)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  cursor: nameSaving ? "default" : "pointer",
                  opacity: nameSaving ? 0.7 : 1,
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEditName}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--ink-dim)",
                  fontFamily: "var(--font-display)",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              {nameError && (
                <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--rose)" }}>{nameError}</span>
              )}
            </form>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem" }}>
                {profile.display_name?.trim() || <span style={{ color: "var(--ink-faint, #5c6684)", fontStyle: "italic" }}>{profile.archetype || "Unnamed Vessel"}</span>}
              </span>
              <button
                type="button"
                onClick={startEditName}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--gold)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Edit
              </button>
            </div>
          )}
        </section>

        {/* Hub Backdrop */}
        <section className="profile-panel" style={{ marginBottom: "22px", padding: "18px 20px" }}>
          <p
            style={{
              margin: "0 0 10px",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-faint, #5c6684)",
            }}
          >
            Hub Backdrop
          </p>
          <p style={{ margin: "0 0 12px", fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
            An image of your own, behind your Hub and this page. Up to 8MB.
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <label
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid var(--gold)",
                color: "var(--gold)",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: backgroundUploading ? "default" : "pointer",
                opacity: backgroundUploading ? 0.6 : 1,
              }}
            >
              {backgroundUploading ? "Uploading…" : profile.hub_background_url ? "Replace image" : "Upload image"}
              <input
                type="file"
                accept="image/*"
                onChange={uploadHubBackground}
                disabled={backgroundUploading}
                style={{ display: "none" }}
              />
            </label>
            {profile.hub_background_url && (
              <button
                type="button"
                onClick={removeHubBackground}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--ink-dim)",
                  fontFamily: "var(--font-display)",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            )}
            {backgroundError && (
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--rose)" }}>{backgroundError}</span>
            )}
          </div>
        </section>

        {/* Ship Skin -- new */}
        <section className="profile-panel" style={{ marginBottom: "22px", padding: "18px 20px" }}>
          <p
            style={{
              margin: "0 0 10px",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-faint, #5c6684)",
            }}
          >
            Ship Skin
          </p>
          <p style={{ margin: "0 0 14px", fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
            The palette this whole page -- and your Hub -- is painted in. Changes everywhere, the moment you pick it.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {SKINS.map((skin) => {
              const isActive = (profile.ship_skin || "heavenly") === skin.key || (!profile.ship_skin && skin.key === "heavenly");
              return (
                <button
                  key={skin.key}
                  type="button"
                  onClick={() => chooseSkin(skin.key)}
                  disabled={skinSaving !== null}
                  title={skin.blurb}
                  style={{
                    width: "128px",
                    padding: "10px",
                    borderRadius: "10px",
                    border: isActive ? `2px solid ${skin.vars["--gold"]}` : "1px solid var(--border)",
                    background: skin.vars["--void"],
                    cursor: skinSaving !== null ? "default" : "pointer",
                    opacity: skinSaving && skinSaving !== skin.key ? 0.6 : 1,
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
                    {[skin.vars["--panel"], skin.vars["--gold"], skin.vars["--rose"]].map((c, i) => (
                      <span key={i} style={{ width: "14px", height: "14px", borderRadius: "50%", background: c, border: `1px solid ${skin.vars["--border"]}` }} />
                    ))}
                  </div>
                  <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.82rem", color: skin.vars["--ink"] }}>
                    {skin.name}
                  </p>
                  <p style={{ margin: "2px 0 0", fontFamily: "var(--font-mono)", fontSize: "9px", color: isActive ? skin.vars["--gold"] : skin.vars["--ink-faint"] }}>
                    {isActive ? "ACTIVE" : " "}
                  </p>
                </button>
              );
            })}
          </div>
          {skinError && (
            <p style={{ margin: "10px 0 0", fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--rose)" }}>{skinError}</p>
          )}
        </section>

        {/* Commons Accent -- Blue key's door, same gating as the Hub. */}
        {hasBlueKey && (
          <section className="profile-panel" style={{ marginBottom: "22px", padding: "18px 20px" }}>
            <p
              style={{
                margin: "0 0 10px",
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ink-faint, #5c6684)",
              }}
            >
              Commons Accent &middot; unlocked by the Blue Heart String
            </p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {COMMONS_ACCENT_PALETTE.map((c) => {
                const isActive = profile.commons_accent === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={isActive}
                    onClick={() => chooseAccent(c.value)}
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      cursor: isActive ? "default" : "pointer",
                      padding: 0,
                      background: c.value,
                      border: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                      boxShadow: isActive ? "0 0 0 2px var(--void), 0 0 0 3px rgba(201,161,90,0.4)" : "none",
                      transition: "box-shadow 0.2s ease",
                    }}
                  />
                );
              })}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  color: "var(--ink-faint, #5c6684)",
                  opacity: accentSaving ? 1 : 0,
                  transition: "opacity 0.3s ease",
                }}
              >
                saving&hellip;
              </span>
            </div>
          </section>
        )}

        {/* Voice Signature -- Voice Tier 4. */}
        <section className="profile-panel" style={{ marginBottom: "22px", padding: "18px 20px" }}>
          <p
            style={{
              margin: "0 0 10px",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-faint, #5c6684)",
            }}
          >
            Voice Signature
          </p>
          {!voiceUnlocked ? (
            <p style={{ margin: 0, fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
              Unlocks at Voice Tier 4. You&rsquo;re at Tier {voiceTier} -- keep speaking up around the
              site and it&rsquo;ll open on its own.
            </p>
          ) : editingSignature ? (
            <form onSubmit={saveVoiceSignature} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input
                autoFocus
                value={signatureDraft}
                onChange={(e) => setSignatureDraft(e.target.value.slice(0, SIGNATURE_MAX))}
                placeholder="A line that's yours."
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--void)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                  fontSize: "0.9rem",
                }}
              />
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={signatureSaving}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--gold)",
                    background: "var(--gold)",
                    color: "var(--void)",
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    cursor: signatureSaving ? "default" : "pointer",
                    opacity: signatureSaving ? 0.7 : 1,
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEditSignature}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--ink-dim)",
                    fontFamily: "var(--font-display)",
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--ink-faint, #5c6684)" }}>
                  {signatureDraft.length}/{SIGNATURE_MAX}
                </span>
                {signatureError && (
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--rose)" }}>{signatureError}</span>
                )}
              </div>
            </form>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontStyle: profile.voice_signature ? "italic" : "normal",
                  fontSize: "0.9rem",
                  color: profile.voice_signature ? "var(--ink)" : "var(--ink-faint, #5c6684)",
                }}
              >
                {profile.voice_signature || "Not set yet."}
              </span>
              <button
                type="button"
                onClick={startEditSignature}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--gold)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {profile.voice_signature ? "Edit" : "Set"}
              </button>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .profile-panel {
          position: relative;
          background: var(--panel);
          border: 1px solid var(--border);
          clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
        }
        .profile-panel::before,
        .profile-panel::after {
          content: "";
          position: absolute;
          width: 10px;
          height: 10px;
          pointer-events: none;
        }
        .profile-panel::before {
          top: 6px;
          right: 6px;
          border-top: 2px solid var(--gold);
          border-right: 2px solid var(--gold);
          opacity: 0.55;
        }
        .profile-panel::after {
          bottom: 6px;
          left: 6px;
          border-bottom: 2px solid var(--gold);
          border-left: 2px solid var(--gold);
          opacity: 0.55;
        }
      `}</style>
    </main>
  );
}
