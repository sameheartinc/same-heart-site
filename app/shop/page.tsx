"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ShopifyProduct } from "@/lib/shopify";

const ACCENT = "#7c9fd9";

// The Merch Ship -- real products once Shopify is connected, an honest
// "still docking" state if it isn't. Open to everyone (no sign-in
// required) so a landing-page click or an outside link (ads, socials)
// lands straight on real products instead of a login wall. Fetches
// through /api/shop/products rather than talking to Shopify directly,
// so the private access token never has to leave the server.
export default function ShopPage() {
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [configured, setConfigured] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/shop/products");
        const json = await res.json();
        setConfigured(Boolean(json.configured));
        setProducts(json.products ?? []);
        if (json.error) setFetchError(json.error);
      } catch {
        setFetchError("Couldn't reach the shop right now.");
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 22px",
        background: "var(--void)",
        color: "var(--ink)",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
        <span
          style={{
            display: "inline-flex",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--panel)",
            border: `1px solid ${ACCENT}`,
            boxShadow: `0 0 22px ${ACCENT}44`,
            marginBottom: "22px",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mark.png"
            alt="Same Heart"
            style={{
              width: "58%",
              height: "58%",
              objectFit: "contain",
              // mark.png is a dark navy shape -- nearly invisible on its
              // own against this same-toned circle, so give it the same
              // gold glow treatment used for the logo everywhere else on
              // the site (see the Galaxy page's core mark).
              filter:
                "drop-shadow(0 0 4px rgba(201,161,90,0.9)) drop-shadow(0 0 9px rgba(201,161,90,0.55))",
            }}
          />
        </span>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.6rem",
            margin: "0 0 6px",
          }}
        >
          The Merch Ship
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: ACCENT,
            margin: "0 0 30px",
          }}
        >
          Shop &gt; Ship
        </p>

        {loadingProducts ? null : !configured ? (
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              padding: "32px",
              maxWidth: "440px",
              margin: "0 auto 30px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                color: "var(--ink-dim)",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Still docking. The Ship isn&rsquo;t connected to the storefront
              yet -- real gear lands here soon.
            </p>
          </div>
        ) : products.length === 0 ? (
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              padding: "32px",
              maxWidth: "440px",
              margin: "0 auto 30px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                color: "var(--ink-dim)",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {fetchError ??
                "The storefront's connected, but there's nothing listed for sale yet."}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "18px",
              textAlign: "left",
              marginBottom: "30px",
            }}
          >
            {products.map((p) => (
              <a
                key={p.id}
                href={p.onlineStoreUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "var(--ink)",
                  transition: "border-color 0.2s ease",
                }}
              >
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }}
                  />
                )}
                <div style={{ padding: "14px" }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                    }}
                  >
                    {p.title}
                  </p>
                  <p style={{ margin: "6px 0 0", color: ACCENT, fontSize: "0.85rem" }}>
                    {p.priceAmount} {p.priceCurrency}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}

        <Link
          href="/galaxy"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-display)",
            fontSize: "0.85rem",
            textDecoration: "none",
            borderBottom: "1px solid var(--gold)",
            paddingBottom: "2px",
          }}
        >
          &larr; Back to the Galaxy
        </Link>

        <div style={{ marginTop: "40px", display: "flex", justifyContent: "center", gap: "16px" }}>
          {[
            { href: "/privacy", label: "Privacy" },
            { href: "/terms", label: "Terms" },
            { href: "/contact", label: "Contact" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: "var(--ink-faint, #5c6684)",
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
