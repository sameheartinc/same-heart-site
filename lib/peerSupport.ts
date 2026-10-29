import { supabase } from "@/lib/supabaseClient";

// Client side of the peer support intake -- the first real step of the
// "intake, matching, check-ins" system Rob's described for Same Heart
// from the start (see supabase/schema_peer_support.sql). Matching and
// check-ins are later passes; this file only knows how to read and
// write a person's own intake, nothing more. Row Level Security on
// peer_support_intakes is what actually keeps every intake private to
// the person who wrote it -- this is just the client call shape around
// that, the same posture as lib/progression.ts's own comment on trust.

export type IntakeRole = "seeking" | "offering" | "both";
export type IntakeFrequency = "daily" | "few_times_week" | "weekly" | "occasional";
export type IntakeStatus = "pending" | "matched" | "closed";

export const FOCUS_AREAS: { id: string; label: string }[] = [
  { id: "isolation", label: "Feeling isolated or lonely" },
  { id: "grief", label: "Grief or loss" },
  { id: "relationships", label: "Relationship or family stress" },
  { id: "overwhelm", label: "Work, school, or life overwhelm" },
  { id: "transition", label: "A big life transition" },
  { id: "accountability", label: "General check-ins & accountability" },
  { id: "other", label: "Something else" },
];

export const FREQUENCY_LABELS: Record<IntakeFrequency, string> = {
  daily: "Daily",
  few_times_week: "A few times a week",
  weekly: "Weekly",
  occasional: "Occasional check-ins",
};

export const ROLE_LABELS: Record<IntakeRole, string> = {
  seeking: "Someone to support me",
  offering: "I'd like to support someone else",
  both: "Either -- whichever is needed",
};

export interface PeerSupportIntake {
  id: string;
  role: IntakeRole;
  focusAreas: string[];
  frequency: IntakeFrequency;
  context: string | null;
  notes: string | null;
  status: IntakeStatus;
  createdAt: string;
  updatedAt: string;
}

interface IntakeRow {
  id: string;
  role: IntakeRole;
  focus_areas: string[];
  frequency: IntakeFrequency;
  context: string | null;
  notes: string | null;
  status: IntakeStatus;
  created_at: string;
  updated_at: string;
}

function fromRow(row: IntakeRow): PeerSupportIntake {
  return {
    id: row.id,
    role: row.role,
    focusAreas: row.focus_areas ?? [],
    frequency: row.frequency,
    context: row.context,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// The one intake that matters right now -- a person's most recent row.
// Once matching exists, a "matched" or "closed" row found here is still
// the right one to show (just read-only); this never filters by status.
export async function fetchMyIntake(): Promise<PeerSupportIntake | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("peer_support_intakes")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return fromRow(data as IntakeRow);
}

export interface IntakeInput {
  role: IntakeRole;
  focusAreas: string[];
  frequency: IntakeFrequency;
  context: string;
  notes: string;
}

// Creates a new pending intake, or -- if one is already pending -- edits
// it in place. The schema's partial unique index only allows one
// pending row per person, so this mirrors that: there is only ever one
// active intake to fill out, however many times someone comes back to
// change it before a future matching pass picks it up.
export async function submitIntake(input: IntakeInput): Promise<PeerSupportIntake | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const uid = userData.user.id;

  const existing = await fetchMyIntake();
  const payload = {
    user_id: uid,
    role: input.role,
    focus_areas: input.focusAreas,
    frequency: input.frequency,
    context: input.context.trim() || null,
    notes: input.notes.trim() || null,
  };

  if (existing && existing.status === "pending") {
    const { data, error } = await supabase
      .from("peer_support_intakes")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) return null;
    return fromRow(data as IntakeRow);
  }

  const { data, error } = await supabase
    .from("peer_support_intakes")
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) return null;
  return fromRow(data as IntakeRow);
}
