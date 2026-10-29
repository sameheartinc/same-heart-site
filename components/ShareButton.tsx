"use client";

import { useEffect, useRef, useState } from "react";

// A single reusable share control -- Rob, Sep 15 2026: "lets also go
// and build the share buttons into the threads and links/posts." On a
// device with the native share sheet (most phones), one tap just opens
// it. Everywhere else, a small menu with the concrete platforms Rob
// named -- X, Facebook, LinkedIn -- plus copy-link, since that's the
// one that actually works everywhere (iMessage, Slack, email, whatever
// someone's actual first move is).
//
// `url` should be an absolute URL (the page this button lives on
// already knows its own canonical link) -- this component doesn't try
// to guess or resolve a relative path.
//
// `sparkId`, when passed, is the CURRENT VIEWER's own Spark ID (never
// the content's author) -- it tags the shared link with `?ref=<Spark
// ID>` so a click-through or eventual signup can be credited back to
// whoever actually shared it (see lib/shareAttribution.ts). Omit it (or
// pass null, e.g. a signed-out visitor with nothing to credit) to share
// the plain link with no tracking at all.
export function ShareButton({
  url,
  title,
  text,
  sparkId,
}: {
  url: string;
  title: string;
  text?: string;
  sparkId?: string | number | null;
}) {
  const shareUrl = (() => {
    if (sparkId === null || sparkId === undefined) return url;
    try {
      const withRef = new URL(url);
      withRef.searchParams.set("ref", String(sparkId));
      return withRef.toString();
    } catch {
      return url;
    }
  })();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  // Mobile fix (Oct 18, 2026) -- same bug as the Hub's Notices panel:
  // `right: 0` on a small inline-block wrapper only keeps the menu
  // on-screen when the Share button happens to sit near the right
  // edge. Share buttons live inline in threads and posts, so that's
  // often not true on a phone. Measuring the button's real position
  // and clamping to the viewport fixes it everywhere this is used.
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleClick() {
    if (canNativeShare) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch {
        // AbortError just means the person closed the native sheet --
        // nothing to show for that.
      }
      return;
    }
    const opening = !open;
    if (opening && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const width = 200; // a bit more than the menu's natural content width
      const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
      setMenuPos({ top: rect.bottom + 6, left });
    }
    setOpen(opening);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can be blocked (permissions, insecure context) --
      // the menu stays open with the link visible below as a fallback.
    }
  }

  const shareText = text ? `${title} -- ${text}` : title;
  const intents = [
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
  ];

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Share"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "999px",
          border: "1px solid var(--border, #ece6d8)",
          background: "var(--panel, #fff)",
          color: "var(--ink-dim, #6f6a85)",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          cursor: "pointer",
        }}
      >
        <span aria-hidden="true">&#8663;</span>
        Share
      </button>

      {open && !canNativeShare && menuPos && (
        <div
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 20,
            minWidth: "170px",
            padding: "8px",
            borderRadius: "10px",
            border: "1px solid var(--border, #ece6d8)",
            background: "var(--panel, #fff)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {intents.map((intent) => (
            <a
              key={intent.label}
              href={intent.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                color: "var(--ink, #2e2a45)",
                fontFamily: "var(--font-body)",
                fontSize: "0.85rem",
                textDecoration: "none",
              }}
            >
              Share to {intent.label}
            </a>
          ))}
          <button
            type="button"
            onClick={copyLink}
            style={{
              padding: "8px 10px",
              borderRadius: "6px",
              border: "none",
              background: "none",
              textAlign: "left",
              color: "var(--ink, #2e2a45)",
              fontFamily: "var(--font-body)",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
