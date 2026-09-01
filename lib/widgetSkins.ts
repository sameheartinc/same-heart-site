// Same Heart -- Widget Skins registry.
//
// Separate, on purpose, from lib/skins.ts (the site-wide Hub/Commons
// theme). That registry recolors the whole page you're standing on; this
// one recolors an individual "widget" -- a self-contained box with its
// own frame, header, and skin switcher, dropped anywhere on the site.
// Two widgets use it today: the corner audio player (components/
// GlobalPlayer.tsx) and the Hub's Capsule (app/hub/page.tsx). Each picks
// its own skin independently (separate localStorage keys), but both draw
// from this one catalog -- that's the "ONE widget engine, MANY skins"
// principle: a new widget only ever needs its own storageKey, never its
// own copy of this file.
//
// The catalog itself now lives in Supabase (the `widget_skins` table),
// not in this file -- see supabase/schema.sql. That's what makes
// /admin/skins meaningful: adding skin #17 is a form submission there,
// not a code change and a deploy here. FALLBACK_SKINS below is only a
// safety net for the moment before the real catalog has loaded (or if
// the fetch ever fails) -- it's intentionally the same 4 skins that used
// to be this file's only content, so a slow network never shows an empty
// picker or an unstyled widget.
//
// The audio player is FRAME-ONLY: its content is an iHeartRadio iframe,
// cross-origin, so its play button/track title/artwork can't be styled
// from here at all -- only the card around it. The Capsule is a widget
// Same Heart actually renders, though, so it needs the fuller token set
// below (panel, text, accent, rose) to skin its interior too, not just
// its frame.

import { supabase } from "@/lib/supabaseClient";

// No longer a fixed union -- keys are admin-addable at runtime now, so
// this is just "a string that happens to identify a skin." Kept as a
// named type (rather than switching every consumer to plain `string`)
// so the intent stays readable at call sites.
export type WidgetSkinKey = string;

export interface WidgetSkin {
  key: WidgetSkinKey;
  name: string;
  description: string;
  // Shown in the thin header bar every widget instance renders above its
  // content -- purely decorative text (a station name/callsign feel),
  // not live data.
  headerLabel: string;
  // "artwork" is reserved for when curated art (see PLAN.md's Midjourney
  // workflow) backs a skin instead of a plain palette -- not rendered
  // specially yet, so every skin today is "palette".
  kind: "palette" | "artwork";
  // Set only on earned skins. Matches an id in lib/evolution.ts's
  // UNLOCKABLES -- a widget only ever offers this skin in its cycle once
  // the viewing profile holds that unlock (see WidgetFrame's
  // lockedSkinKeys prop). Skins without this are free, exactly as before.
  unlockId?: string;
  // Only set on kind: "artwork" skins -- a path under /public (or any
  // absolute URL) to a real image. WidgetFrame paints it as the outer
  // frame's background; `vars` still matters even here, since the
  // identity card and header sitting on top of it are still styled from
  // these tokens (see components/WidgetFrame.tsx).
  imageUrl?: string;
  vars: {
    "--widget-background": string;
    "--widget-panel": string;
    "--widget-border": string;
    "--widget-radius": string;
    "--widget-shadow": string;
    "--widget-header-bg": string;
    "--widget-header-text": string;
    "--widget-text": string;
    "--widget-text-dim": string;
    "--widget-text-faint": string;
    "--widget-accent": string;
    "--widget-rose": string;
  };
}

export const DEFAULT_WIDGET_SKIN_KEY: WidgetSkinKey = "classic";

// The safety net described above -- identical to the 4 skins that were
// this file's entire content before the catalog moved to Supabase.
export const FALLBACK_SKINS: WidgetSkin[] = [
  {
    key: "classic",
    name: "Classic",
    description: "Clean and quiet -- the original card.",
    headerLabel: "SIGNAL",
    kind: "palette",
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
  },
  {
    key: "retro",
    name: "Retro",
    description: "A beveled late-90s messenger titlebar.",
    headerLabel: "SIGNAL.EXE",
    kind: "palette",
    vars: {
      "--widget-background": "#c0c0c0",
      "--widget-panel": "#d4d0c8",
      "--widget-border": "#4d4d4d",
      "--widget-radius": "2px",
      "--widget-shadow":
        "inset 1px 1px 0 #ffffff, inset -1px -1px 0 #4d4d4d, 2px 2px 0 rgba(0,0,0,0.45)",
      "--widget-header-bg": "linear-gradient(180deg, #2a6fe0, #0a3aa8)",
      "--widget-header-text": "#ffffff",
      "--widget-text": "#000000",
      "--widget-text-dim": "#3a3a3a",
      "--widget-text-faint": "#6b6b6b",
      "--widget-accent": "#2a6fe0",
      "--widget-rose": "#c0392b",
    },
  },
  {
    key: "cyberpunk",
    name: "Cyberpunk",
    description: "Neon on near-black.",
    headerLabel: "SIGNAL_v2",
    kind: "palette",
    vars: {
      "--widget-background": "#080b12",
      "--widget-panel": "#101827",
      "--widget-border": "#00ffff",
      "--widget-radius": "4px",
      "--widget-shadow": "0 0 16px rgba(255,0,255,0.55), 0 0 4px rgba(0,255,255,0.6)",
      "--widget-header-bg": "#101827",
      "--widget-header-text": "#ff00ff",
      "--widget-text": "#e8f9ff",
      "--widget-text-dim": "#9fd8e0",
      "--widget-text-faint": "#5f7a82",
      "--widget-accent": "#00ffff",
      "--widget-rose": "#ff2f7a",
    },
  },
  {
    key: "aurora",
    name: "Aurora",
    description: "Earned by holding at least 2 Keys and staying 30 days.",
    headerLabel: "SIGNAL_AURORA",
    kind: "palette",
    unlockId: "widget-skin-aurora",
    vars: {
      "--widget-background": "#0a1420",
      "--widget-panel": "#122236",
      "--widget-border": "#3fd9b8",
      "--widget-radius": "16px",
      "--widget-shadow": "0 0 22px rgba(63,217,184,0.35), 0 0 8px rgba(155,111,224,0.3)",
      "--widget-header-bg": "linear-gradient(90deg, #163a4a, #1f2a4a)",
      "--widget-header-text": "#9be8d8",
      "--widget-text": "#eaf8f4",
      "--widget-text-dim": "#a9d3c8",
      "--widget-text-faint": "#5d8a7d",
      "--widget-accent": "#3fd9b8",
      "--widget-rose": "#e0567b",
    },
  },
];

// Module-level cache -- every widget on every page shares one fetch of
// the catalog rather than each WidgetFrame instance hitting Supabase on
// its own. `null` means "not fetched yet"; a resolved array (even an
// empty one, which shouldn't happen but is handled) means the fetch is
// done. `inFlight` collapses concurrent calls (e.g. the audio player and
// the Capsule both mounting at once) into one request.
let cachedSkins: WidgetSkin[] | null = null;
let inFlight: Promise<WidgetSkin[]> | null = null;

interface WidgetSkinRow {
  key: string;
  name: string;
  description: string;
  header_label: string;
  kind: string;
  unlock_id: string | null;
  image_url: string | null;
  vars: WidgetSkin["vars"];
}

function rowToSkin(row: WidgetSkinRow): WidgetSkin {
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    headerLabel: row.header_label,
    kind: row.kind === "artwork" ? "artwork" : "palette",
    unlockId: row.unlock_id ?? undefined,
    imageUrl: row.image_url ?? undefined,
    vars: row.vars,
  };
}

// Fetches the real catalog from Supabase once, caches it for the rest of
// this page session, and falls back to FALLBACK_SKINS on any failure
// (offline, RLS misconfigured, table not migrated yet) so a widget never
// renders unstyled just because the network hiccuped.
export async function loadWidgetSkins(): Promise<WidgetSkin[]> {
  if (cachedSkins) return cachedSkins;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data, error } = await supabase
        .from("widget_skins")
        .select("key, name, description, header_label, kind, unlock_id, image_url, vars")
        .order("sort_order", { ascending: true });

      if (error || !data || data.length === 0) {
        cachedSkins = FALLBACK_SKINS;
      } else {
        cachedSkins = (data as WidgetSkinRow[]).map(rowToSkin);
      }
    } catch {
      cachedSkins = FALLBACK_SKINS;
    }
    return cachedSkins!;
  })();

  return inFlight;
}

// Pure lookup against an already-loaded catalog -- doesn't fetch, so
// callers control when a network request happens (see WidgetFrame).
// Falls back to the catalog's own default entry, or the first entry if
// even that's missing, so this never returns undefined.
export function getWidgetSkin(key: string | null | undefined, catalog: WidgetSkin[]): WidgetSkin {
  return (
    catalog.find((s) => s.key === key) ??
    catalog.find((s) => s.key === DEFAULT_WIDGET_SKIN_KEY) ??
    catalog[0] ??
    FALLBACK_SKINS[0]
  );
}
