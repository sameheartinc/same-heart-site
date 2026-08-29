import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Same Heart",
  description: "How Same Heart Inc. collects, uses, and protects your information.",
};

// Plain server component -- static, crawlable, no auth gate. Content is a
// good-faith starting policy reflecting what the site actually does today
// (Supabase accounts, Shopify checkout, RSS-sourced news, basic analytics).
// Not a substitute for a lawyer's review, especially once paid ads, more
// personal data, or new jurisdictions come into play.
export default function PrivacyPage() {
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
          Privacy Policy
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
            Same Heart Inc. (&ldquo;Same Heart,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;) is a company incorporated in Ontario, Canada. This policy explains
            what information we collect through sameheart.ca (the &ldquo;Site&rdquo;), how we use
            it, and the choices you have.
          </p>

          <h2 style={sectionStyle}>Information We Collect</h2>
          <p>
            <strong style={{ color: "var(--ink)" }}>Account information.</strong> If you create a
            Same Heart account, we collect your email address and any profile details you choose
            to add, through our authentication provider, Supabase.
          </p>
          <p>
            <strong style={{ color: "var(--ink)" }}>Waitlist sign-ups.</strong> If you leave your
            email on our waitlist form, we store that email so we can notify you.
          </p>
          <p>
            <strong style={{ color: "var(--ink)" }}>Purchases.</strong> The Merch Ship displays
            products pulled live from our Shopify store. When you buy something, checkout happens
            on Shopify&rsquo;s own platform under Shopify&rsquo;s privacy practices &mdash; we do
            not see or store your payment details.
          </p>
          <p>
            <strong style={{ color: "var(--ink)" }}>Usage data.</strong> We use basic,
            privacy-respecting analytics (such as Vercel Web Analytics) to understand which pages
            get visited and roughly how much traffic the Site gets. This does not include your
            name or email, and we do not sell this data to anyone.
          </p>

          <h2 style={sectionStyle}>How We Use Information</h2>
          <p>
            We use the information above to operate the Site, maintain your account, fulfill
            orders (via Shopify), send waitlist or account-related updates, and understand how
            people use the Site so we can improve it.
          </p>

          <h2 style={sectionStyle}>Cookies</h2>
          <p>
            The Site uses essential cookies/local storage needed to keep you signed in, plus
            lightweight analytics cookies. We do not use cookies for cross-site ad tracking.
          </p>

          <h2 style={sectionStyle}>Third-Party Services</h2>
          <p>
            We rely on a small number of trusted providers to run the Site: Supabase (accounts and
            data storage), Vercel (hosting and analytics), Shopify (products and checkout), and
            Google (search, and Google Merchant Center for our product listings). Each of these
            providers has its own privacy policy governing the data they process on our behalf.
          </p>

          <h2 style={sectionStyle}>Data Retention</h2>
          <p>
            We keep account and waitlist information for as long as your account is active or as
            needed to provide the Site&rsquo;s features. You can ask us to delete your data at any
            time (see &ldquo;Your Rights&rdquo; below).
          </p>

          <h2 style={sectionStyle}>Your Rights</h2>
          <p>
            If you&rsquo;re in Canada, our handling of your personal information is governed by
            PIPEDA (the Personal Information Protection and Electronic Documents Act). You can ask
            us to access, correct, or delete the personal information we hold about you at any
            time by contacting us (see below).
          </p>

          <h2 style={sectionStyle}>Children&rsquo;s Privacy</h2>
          <p>
            The Site is not directed at children, and we do not knowingly collect personal
            information from children under 13.
          </p>

          <h2 style={sectionStyle}>Changes to This Policy</h2>
          <p>
            We may update this policy as the Site grows. We&rsquo;ll update the effective date
            above when we do.
          </p>

          <h2 style={sectionStyle}>Contact Us</h2>
          <p>
            Questions about this policy or your data? Email us at{" "}
            <a href="mailto:sameheartinc@gmail.com" style={{ color: "var(--gold)" }}>
              sameheartinc@gmail.com
            </a>
            . See also our{" "}
            <Link href="/terms" style={{ color: "var(--gold)" }}>
              Terms of Service
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
