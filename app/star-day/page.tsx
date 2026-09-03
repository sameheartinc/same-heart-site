"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Star Day used to be a mandatory "enter your birthday" form blocking
// the Hub -- removed (see IDEAS.md, Sep 3 2026: Rob's call was that
// asking for a birthday up front isn't necessary and risks losing people
// before they ever see the Hub, plus a direct report that the ask itself
// showed up somewhere on the front end). Every profile now gets its
// designation/frequency/archetype automatically at signup, computed from
// when the account joined Same Heart instead of when the person was born
// -- see supabase/schema.sql's handle_new_user()/compute_signal(). This
// route is kept only so an old bookmark or link doesn't 404 -- it never
// asks for anything, and never will; it just sends you straight to the
// Hub. A real, OPTIONAL birthday field belongs in a future profile
// builder inside Settings, not a blocking redirect here -- not built yet.
export default function StarDayPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/hub");
  }, [router]);

  return null;
}
