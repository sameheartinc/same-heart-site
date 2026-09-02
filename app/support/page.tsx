import Link from "next/link";

export const metadata = {
  title: "Support Services — Same Heart",
  description:
    "Real crisis and support helplines for the US and Canada -- suicide and crisis support, domestic violence, substance use, LGBTQ+ support, and more. Same Heart is not a crisis service; if you or someone else is in immediate danger, call 911.",
};

interface Resource {
  name: string;
  blurb: string;
  phoneLabel?: string;
  phoneHref?: string;
  textLabel?: string;
  textHref?: string;
  webLabel?: string;
  webHref?: string;
}

interface Category {
  title: string;
  resources: Resource[];
}

// Every number and link on this page was checked against each
// organization's own site before publishing (see IDEAS.md for the date
// and sources) -- crisis resources are exactly the kind of information
// that's actively harmful when it's stale or wrong, so this list gets
// re-checked periodically rather than typed once and forgotten. Where a
// federal or partner program's status was genuinely in flux (the 988
// "Press 3" LGBTQ+ youth option, for instance), this page links to the
// organization's own independent line instead of the uncertain one.
const CATEGORIES: Category[] = [
  {
    title: "Suicide & crisis support",
    resources: [
      {
        name: "988 Suicide & Crisis Lifeline",
        blurb: "Free, confidential, 24/7 support for anyone in the US or Canada.",
        phoneLabel: "Call 988",
        phoneHref: "tel:988",
        textLabel: "Text 988",
        textHref: "sms:988",
      },
      {
        name: "988 in Quebec",
        blurb: "Calls to 988 from Quebec are redirected here automatically -- this is the direct number.",
        phoneLabel: "Call 1-866-APPELLE (277-3553)",
        phoneHref: "tel:18662773553",
        textLabel: "Text 53 53 53",
        textHref: "sms:535353",
      },
      {
        name: "Crisis Text Line",
        blurb: "Free, 24/7 text-based crisis support, US only.",
        textLabel: "Text 741741",
        textHref: "sms:741741",
        webLabel: "crisistextline.org",
        webHref: "https://www.crisistextline.org/text-us/",
      },
      {
        name: "Kids Help Phone",
        blurb: "Canada-wide, 24/7 support for ages 5-29, in English and French.",
        phoneLabel: "Call 1-800-668-6868",
        phoneHref: "tel:18006686868",
        textLabel: "Text CONNECT to 686868",
        textHref: "sms:686868",
        webLabel: "kidshelpphone.ca",
        webHref: "https://kidshelpphone.ca/",
      },
    ],
  },
  {
    title: "Domestic violence & abuse",
    resources: [
      {
        name: "National Domestic Violence Hotline",
        blurb: "Free, confidential, 24/7 support, US.",
        phoneLabel: "Call 1-800-799-7233",
        phoneHref: "tel:18007997233",
        textLabel: "Text START to 88788",
        textHref: "sms:88788",
        webLabel: "thehotline.org",
        webHref: "https://www.thehotline.org/",
      },
      {
        name: "Get Help Now (Canada)",
        blurb:
          "Canada's federal directory for gender-based and domestic violence support -- most helplines are provincial, so this points to the right one for where you are.",
        webLabel: "canada.ca/get-help-now",
        webHref: "https://www.canada.ca/en/women-gender-equality/gender-based-violence/get-help-now.html",
      },
      {
        name: "Canadian Human Trafficking Hotline",
        blurb: "Toll-free, 24/7, multilingual, Canada-wide.",
        phoneLabel: "Call 1-833-900-1010",
        phoneHref: "tel:18339001010",
      },
    ],
  },
  {
    title: "Substance use & mental health",
    resources: [
      {
        name: "SAMHSA National Helpline",
        blurb: "Free, confidential, 24/7 treatment referral for mental health and substance use, US.",
        phoneLabel: "Call 1-800-662-4357",
        phoneHref: "tel:18006624357",
        webLabel: "samhsa.gov",
        webHref: "https://www.samhsa.gov/find-help/helplines/national-helpline",
      },
    ],
  },
  {
    title: "LGBTQ+ support",
    resources: [
      {
        name: "The Trevor Project",
        blurb: "24/7 crisis support for LGBTQ+ young people, US.",
        phoneLabel: "Call 1-866-488-7386",
        phoneHref: "tel:18664887386",
        textLabel: "Text START to 678-678",
        textHref: "sms:678678",
        webLabel: "thetrevorproject.org/get-help",
        webHref: "https://www.thetrevorproject.org/get-help/",
      },
      {
        name: "Trans Lifeline",
        blurb: "Peer support run by and for trans people, US and Canada.",
        phoneLabel: "US: (877) 565-8860 · Canada: (877) 330-6366",
        phoneHref: "tel:18775658860",
        webLabel: "translifeline.org",
        webHref: "https://translifeline.org/hotline/",
      },
    ],
  },
  {
    title: "Indigenous peoples (Canada)",
    resources: [
      {
        name: "Hope for Wellness Helpline",
        blurb: "Toll-free, 24/7 counselling and crisis support for First Nations, Inuit, and Metis, in English, French, and on request Cree, Ojibway, and Inuktitut.",
        phoneLabel: "Call 1-855-242-3310",
        phoneHref: "tel:18552423310",
      },
    ],
  },
  {
    title: "General help & referrals",
    resources: [
      {
        name: "211",
        blurb: "Free, confidential referrals to local health, social, and community services, US and Canada.",
        phoneLabel: "Call 211",
        phoneHref: "tel:211",
        webLabel: "211.org / 211.ca",
        webHref: "https://www.211.org/",
      },
      {
        name: "Emergency services",
        blurb: "If you or someone else is in immediate danger, this comes first.",
        phoneLabel: "Call 911",
        phoneHref: "tel:911",
      },
    ],
  },
];

export default function SupportPage() {
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

        <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "22px 0 6px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.png" alt="" aria-hidden="true" style={{ width: "34px", height: "auto" }} />
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.8rem",
              margin: 0,
            }}
          >
            Support Services
          </h1>
        </div>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-faint, #5c6684)",
            margin: "0 0 20px",
          }}
        >
          Real help, real numbers -- no account or login needed
        </p>

        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--gold)",
            borderRadius: "14px",
            padding: "16px 18px",
            marginBottom: "36px",
            fontFamily: "var(--font-body)",
            fontSize: "0.92rem",
            lineHeight: 1.6,
            color: "var(--ink-dim)",
          }}
        >
          Same Heart is not a crisis service, and no one here is monitoring this page in
          real time. If you or someone else is in immediate danger, call{" "}
          <a href="tel:911" style={{ color: "var(--gold)", fontWeight: 700 }}>
            911
          </a>{" "}
          (or your local emergency number) first. Everything below is free, confidential,
          and run by real crisis organizations in the US and Canada.
        </div>

        {CATEGORIES.map((cat) => (
          <div key={cat.title} style={{ marginBottom: "34px" }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "1.05rem",
                margin: "0 0 14px",
                color: "var(--ink)",
              }}
            >
              {cat.title}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {cat.resources.map((r) => (
                <div
                  key={r.name}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                    }}
                  >
                    {r.name}
                  </p>
                  <p
                    style={{
                      margin: "0 0 10px",
                      fontFamily: "var(--font-body)",
                      fontStyle: "italic",
                      fontSize: "0.85rem",
                      color: "var(--ink-dim)",
                    }}
                  >
                    {r.blurb}
                  </p>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    {r.phoneHref && (
                      <a href={r.phoneHref} style={resourceLinkStyle}>
                        {r.phoneLabel}
                      </a>
                    )}
                    {r.textHref && (
                      <a href={r.textHref} style={resourceLinkStyle}>
                        {r.textLabel}
                      </a>
                    )}
                    {r.webHref && (
                      <a href={r.webHref} target="_blank" rel="noopener noreferrer" style={resourceLinkStyle}>
                        {r.webLabel} &rarr;
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.04em",
            color: "var(--ink-faint, #5c6684)",
            marginTop: "8px",
          }}
        >
          Every number on this page was checked against the organization&rsquo;s own site
          before publishing, but phone lines and services can change -- if something here
          seems wrong,{" "}
          <Link href="/contact" style={{ color: "var(--gold)" }}>
            let us know
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

const resourceLinkStyle: React.CSSProperties = {
  color: "var(--gold)",
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  letterSpacing: "0.03em",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
