"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import {
  listMyConversations,
  listCommunities,
  type CommonsThread,
  type Community,
} from "@/lib/commons";

// "My Conversations" -- every thread you've started or replied to, in
// one formatted, always-linked list. The Commons homepage's "Live now"
// and "Unanswered" sections already link each thread to
// /commons/t/[id]; this page is the missing complement to those --
// somewhere that shows only *your* active conversations, across every
// community, sorted by whichever one moved most recently. See
// lib/commons.ts's listMyConversations for the query.
export default function MyConversationsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [threads, setThreads] = useState<CommonsThread[]>([]);
  const [communities, setCommunities] = useState<Record<string, Community>>({});

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const [myThreads, allCommunities] = await Promise.all([
        listMyConversations(userData.user.id),
        listCommunities(),
      ]);

      setThreads(myThreads);
      setCommunities(Object.fromEntries(allCommunities.map((c) => [c.id, c])));
      setChecking(false);
    })();
  }, [router]);

  if (checking) return <PageLoading />;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <Link
          href="/commons"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-display)",
            fontSize: "0.82rem",
            textDecoration: "none",
          }}
        >
          &larr; Back to the Commons
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.6rem",
            margin: "20px 0 6px",
          }}
        >
          My Conversations
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--ink-dim)",
            maxWidth: "56ch",
            margin: "0 0 28px",
          }}
        >
          Every discussion or question you&rsquo;ve started or replied to, most recently
          active first.
        </p>

        {threads.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)" }}>
            Nothing yet -- start a discussion or reply to one in the Commons and it&rsquo;ll
            show up here.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {threads.map((t) => {
              const community = t.community_id ? communities[t.community_id] : null;
              return (
                <li key={t.id}>
                  <Link
                    href={`/commons/t/${t.id}`}
                    style={{
                      display: "block",
                      padding: "14px 16px",
                      borderRadius: "12px",
                      background: "var(--panel)",
                      border: "1px solid var(--border)",
                      textDecoration: "none",
                      color: "var(--ink)",
                    }}
                  >
                    <p style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.92rem" }}>
                      {t.kind === "question" ? "? " : ""}
                      {t.title}
                    </p>
                    <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", color: "var(--ink-faint, #5c6684)" }}>
                      {community ? community.name : "General"} &middot; {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"} &middot; last active{" "}
                      {new Date(t.last_activity_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
