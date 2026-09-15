"use client";

import { useEffect, useMemo, useState } from "react";
import { youtubeVideoId, isXStatusUrl } from "@/lib/linkEmbed";

// A live embed of a YouTube video or X post -- Rob, Sep 15 2026: "I want
// people to be able to drop a link from X or youtube ... and for the
// video or feed to come up." Shared between the transmit compose box
// (app/commons/page.tsx, showLabel=true -- "here's what you're about to
// send") and the public Exchange feed (app/commons/exchange/page.tsx,
// showLabel=false -- the card around it already says who sent what).
//
// YouTube renders instantly: just a video ID parsed out of the URL
// client-side (lib/linkEmbed.ts), no network call, dropped into a
// youtube-nocookie iframe. X needs a real request, since a browser can't
// reliably call Twitter's oEmbed endpoint cross-origin -- goes through
// app/api/exchange/oembed/route.ts, a small read-only proxy, debounced
// so it's not firing on every keystroke. Any other kind of link renders
// nothing here -- this is a bonus preview, never a requirement.
export function LinkEmbedPreview({ url, showLabel = true }: { url: string; showLabel?: boolean }) {
  const trimmed = url.trim();
  const ytId = useMemo(() => youtubeVideoId(trimmed), [trimmed]);
  const isX = useMemo(() => isXStatusUrl(trimmed), [trimmed]);
  const [xEmbed, setXEmbed] = useState<{ html: string; forUrl: string } | null>(null);
  const [xLoading, setXLoading] = useState(false);
  const [xFailed, setXFailed] = useState(false);

  useEffect(() => {
    if (!isX) return;
    if (xEmbed?.forUrl === trimmed) return;
    setXFailed(false);
    const timer = setTimeout(async () => {
      setXLoading(true);
      try {
        const res = await fetch(`/api/exchange/oembed?url=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        if (res.ok && typeof json.html === "string") {
          setXEmbed({ html: json.html, forUrl: trimmed });
        } else {
          setXFailed(true);
        }
      } catch {
        setXFailed(true);
      } finally {
        setXLoading(false);
      }
    }, 550);
    return () => clearTimeout(timer);
  }, [trimmed, isX, xEmbed]);

  // Twitter's embed HTML only renders once widgets.js has run over it --
  // load it once, lazily, only the first time there's actually a tweet
  // to show anywhere on the page.
  useEffect(() => {
    if (!xEmbed) return;
    const w = window as any;
    if (w.twttr?.widgets) {
      w.twttr.widgets.load();
      return;
    }
    if (document.getElementById("twitter-widgets-js")) return;
    const script = document.createElement("script");
    script.id = "twitter-widgets-js";
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    document.body.appendChild(script);
  }, [xEmbed]);

  if (!ytId && !isX) return null;

  return (
    <div style={{ marginBottom: showLabel ? "14px" : "10px" }}>
      {showLabel && (
        <p
          style={{
            margin: "0 0 8px",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--gold)",
          }}
        >
          {ytId
            ? "Video detected — ready to transmit"
            : xLoading
            ? "Pulling in the post..."
            : xEmbed
            ? "Post detected — ready to transmit"
            : xFailed
            ? "Couldn't preview that post -- it'll still transmit fine."
            : "Checking..."}
        </p>
      )}
      {ytId && (
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "420px",
            paddingTop: "56.25%",
            borderRadius: "8px",
            overflow: "hidden",
            border: "1px solid rgba(184,134,63,0.4)",
          }}
        >
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}`}
            title="YouTube preview"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          />
        </div>
      )}
      {isX && xEmbed && (
        <div
          style={{
            maxWidth: "420px",
            maxHeight: "420px",
            overflowY: "auto",
            borderRadius: "8px",
            border: "1px solid rgba(184,134,63,0.4)",
            background: "#fff",
            padding: "6px",
          }}
          dangerouslySetInnerHTML={{ __html: xEmbed.html }}
        />
      )}
    </div>
  );
}
