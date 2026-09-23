"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureRefFromUrl, recordShareVisit } from "@/lib/shareAttribution";

// Mounted once, sitewide, in app/layout.tsx. On any page load that
// carries a real ?ref=<Spark ID> (added by components/ShareButton.tsx
// whenever the signed-in sharer's own Spark ID is known), this captures
// it for later signup attribution and records a distinct-visitor share
// visit toward that Spark's small click-through reward. See
// lib/shareAttribution.ts for what each of those actually means and
// their very different trust levels.
function Capture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  useEffect(() => {
    if (!ref || !/^\d+$/.test(ref)) return;
    captureRefFromUrl(ref);
    const { targetKind, targetId } = classifyPath(pathname);
    recordShareVisit(ref, targetKind, targetId);
  }, [pathname, ref]);

  return null;
}

// Only content pages that are actually shareable (see every
// <ShareButton> call site) carry a meaningful target -- anything else
// with a stray ?ref= (someone hand-editing a URL) is still captured for
// signup attribution above, just logged under a generic "page" kind
// rather than inventing a fake thread/community/transmission id.
function classifyPath(pathname: string): { targetKind: string; targetId: string } {
  const thread = pathname.match(/^\/commons\/t\/([^/]+)/);
  if (thread) return { targetKind: "thread", targetId: thread[1] };
  const exchange = pathname.match(/^\/commons\/exchange\/([^/]+)/);
  if (exchange) return { targetKind: "exchange", targetId: exchange[1] };
  const community = pathname.match(/^\/commons\/c\/([^/]+)/);
  if (community) return { targetKind: "community", targetId: community[1] };
  return { targetKind: "page", targetId: pathname };
}

// useSearchParams() needs a Suspense boundary wherever it's used, or
// Next.js forces the entire app out of static rendering -- wrapping it
// right here means app/layout.tsx doesn't need to know that detail.
export default function ShareAttributionCapture() {
  return (
    <Suspense fallback={null}>
      <Capture />
    </Suspense>
  );
}
