import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Same Heart",
  description: "The terms that govern your use of sameheart.ca.",
};

export default function TermsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "56px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          &larr; Same Heart
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.8rem",
            margin: "22px 0 6px",
          }}
        >
          Terms of Service
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-faint, #5c6684)",
            margin: "0 0 32px",
          }}
        >
          Effective August 29, 2026
        </p>

        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.98rem",
            lineHeight: 1.75,
            color: "var(--ink-dim)",
          }}
        >
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of sameheart.ca (the
            &ldquo;Site&rdquo;), operated by Same Heart Inc., a company incorporated in Ontario,
            Canada. By using the Site, you agree to these Terms.
          </p>

          <h2 style={sectionStyle}>The Site Is Evolving</h2>
          <p>
            Same Heart is being built in the open. Some features are fully live, and others are
            honest &ldquo;coming soon&rdquo; placeholders. We&rsquo;ll always try to tell you
            plainly which is which rather than fake a feature that isn&rsquo;t really there yet.
          </p>

          <h2 style={sectionStyle}>Accounts</h2>
          <p>
            Some parts of the Site require an account. You&rsquo;re responsible for keeping your
            login secure and for anything that happens under your account. You must provide an
            accurate email address.
          </p>

          <h2 style={sectionStyle}>Purchases</h2>
          <p>
            Products shown in the Merch Ship are sold through our Shopify store. Checkout,
            payment processing, shipping, and returns are handled by Shopify and our fulfillment
            partners under their own terms. Prices and product availability may change at any
            time.
          </p>

          <h2 style={sectionStyle}>Trademarks &amp; Intellectual Property</h2>
          <p>
            SAMEHEART&trade; and the Same Heart name, logo, and site content are the property of
            Same Heart Inc. unless otherwise noted. You may not copy, resell, or misrepresent our
            branding as your own.
          </p>

          <h2 style={sectionStyle}>The Signal (News Content)</h2>
          <p>
            The Signal feed aggregates headlines and links from third-party news sources via their
            public feeds. Linking to an article is not an endorsement of its content, and all
            rights to that content remain with its original publisher.
          </p>

          <h2 style={sectionStyle}>Acceptable Use</h2>
          <p>
            Don&rsquo;t use the Site to harass others, post illegal content, attempt to break or
            abuse the Site&rsquo;s systems, or misuse any community space (like the Commons) in
            ways that make it worse for everyone else.
          </p>

          <h2 style={sectionStyle}>Disclaimers</h2>
          <p>
            The Site is provided &ldquo;as is.&rdquo; We do our best to keep things accurate and
            running smoothly, but we don&rsquo;t guarantee the Site will always be error-free,
            uninterrupted, or exactly as described at every moment, especially while features are
            actively being built.
          </p>

          <h2 style={sectionStyle}>Limitation of Liability</h2>
          <p>
            To the extent permitted by law, Same Heart Inc. is not liable for indirect, incidental,
            or consequential damages arising from your use of the Site.
          </p>

          <h2 style={sectionStyle}>Governing Law</h2>
          <p>
            These Terms are governed by the laws of the Province of Ontario and the federal laws
            of Canada applicable in Ontario.
          </p>

          <h2 style={sectionStyle}>Changes to These Terms</h2>
          <p>
            We may update these Terms as the Site grows. We&rsquo;ll update the effective date
            above when we do.
          </p>

          <h2 style={sectionStyle}>Contact Us</h2>
          <p>
            Questions about these Terms? Email us at{" "}
            <a href="mailto:sameheartinc@gmail.com" style={{ color: "var(--gold)" }}>
              sameheartinc@gmail.com
            </a>
            . See also our{" "}
            <Link href="/privacy" style={{ color: "var(--gold)" }}>
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/contact" style={{ color: "var(--gold)" }}>
              Contact
            </Link>{" "}
            page.
          </p>
        </div>
      </div>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "1.05rem",
  color: "var(--ink)",
  margin: "30px 0 8px",
};
