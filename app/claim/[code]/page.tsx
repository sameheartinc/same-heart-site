"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ensureSession } from "../../../lib/session";
import { redeemGiftCode, REWARD_CATALOG } from "../../../lib/rewards";
import { redeemLocalGiftCode } from "../../../lib/localState";

// Reached from a gift email's "Claim it" link. Deliberately does NOT
// redeem on page load -- email clients and security scanners often
// prefetch links, and an auto-redeeming GET would burn the gift before
// the actual recipient ever saw it. Redemption only happens on a real
// button click.
export default function ClaimPage() {
  const params = useParams<{ code: string }>();
  const [status, setStatus] = useState<"idle" | "claiming" | "done" | "error">("idle");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  async function handleClaim() {
    setStatus("claiming");
    try {
      await ensureSession();
      const rewardKey = await redeemGiftCode(params.code);
      setTitle(REWARD_CATALOG[rewardKey]?.title ?? "A gift");
      setStatus("done");
    } catch {
      const rewardKey = redeemLocalGiftCode(params.code);
      if (rewardKey) {
        setTitle(REWARD_CATALOG[rewardKey]?.title ?? "A gift");
        setStatus("done");
      } else {
        setMessage("That code didn't match anything, or it's already been claimed.");
        setStatus("error");
      }
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        background:
          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201,161,90,0.12), transparent 60%), var(--void)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "11px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--gold)",
          marginBottom: "18px",
        }}
      >
        Same Heart&trade;
      </p>

      {status !== "done" ? (
        <>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(1.8rem, 6vw, 2.8rem)",
              margin: "0 0 22px",
            }}
          >
            Someone sent you something.
          </h1>
          <button
            onClick={handleClaim}
            disabled={status === "claiming"}
            style={{
              background: "var(--gold)",
              border: "none",
              borderRadius: "999px",
              padding: "14px 30px",
              color: "var(--void)",
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: status === "claiming" ? "default" : "pointer",
              opacity: status === "claiming" ? 0.7 : 1,
            }}
          >
            {status === "claiming" ? "Claiming..." : "Claim it"}
          </button>
          {status === "error" && (
            <p style={{ color: "var(--rose)", marginTop: "16px", fontSize: "0.9rem" }}>
              {message}
            </p>
          )}
        </>
      ) : (
        <>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(1.8rem, 6vw, 2.8rem)",
              margin: "0 0 22px",
              color: "var(--gold)",
            }}
          >
            {title}
          </h1>
          <Link
            href="/"
            style={{
              color: "var(--gold)",
              fontFamily: "var(--font-display)",
              textDecoration: "none",
              borderBottom: "1px solid var(--gold)",
              paddingBottom: "2px",
            }}
          >
            Continue to Same Heart &rarr;
          </Link>
        </>
      )}
    </main>
  );
}
