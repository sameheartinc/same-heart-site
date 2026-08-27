"use client";

// Cloudflare Turnstile -- proves a visitor is human before they get an
// anonymous Supabase session, without a visible checkbox for real people.
// `appearance: "interaction-only"` means the widget stays invisible and
// only renders a challenge if Cloudflare's risk score actually calls for
// one. Enable it: create a Turnstile widget at dash.cloudflare.com, put
// the site key in NEXT_PUBLIC_TURNSTILE_SITE_KEY, and the secret key in
// Supabase Dashboard -> Authentication -> Attack Protection.
//
// Until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, getTurnstileToken()
// resolves to null and callers proceed without a token -- same as
// before Turnstile existed.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const TIMEOUT_MS = 10000;

interface TurnstileGlobal {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      appearance?: "always" | "execute" | "interaction-only";
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("failed to load turnstile script"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function getTurnstileToken(): Promise<string | null> {
  if (!SITE_KEY || typeof window === "undefined") return Promise.resolve(null);

  return loadScript()
    .then(
      () =>
        new Promise<string | null>((resolve) => {
          const turnstile = window.turnstile;
          if (!turnstile) {
            resolve(null);
            return;
          }

          const container = document.createElement("div");
          container.style.position = "fixed";
          container.style.bottom = "16px";
          container.style.right = "16px";
          container.style.zIndex = "9999";
          document.body.appendChild(container);

          let settled = false;
          let widgetId = "";

          const finish = (token: string | null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            if (widgetId) {
              try {
                turnstile.remove(widgetId);
              } catch {
                // widget already gone -- nothing to clean up
              }
            }
            container.remove();
            resolve(token);
          };

          const timeoutId = setTimeout(() => finish(null), TIMEOUT_MS);

          widgetId = turnstile.render(container, {
            sitekey: SITE_KEY,
            theme: "dark",
            appearance: "interaction-only",
            callback: (token) => finish(token),
            "error-callback": () => finish(null),
            "expired-callback": () => finish(null),
          });
        })
    )
    .catch(() => null);
}
