import { supabase } from "./supabaseClient";
import { CampaignSuggestion } from "../app/api/campaigns/suggest/route";

export interface Campaign {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  location: string | null;
  pathKey: string | null;
  status: "draft" | "active" | "completed";
  suggestions: CampaignSuggestion[];
  createdAt: string;
}

interface CampaignRow {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  location: string | null;
  path_key: string | null;
  status: "draft" | "active" | "completed";
  suggestions: CampaignSuggestion[] | null;
  created_at: string;
}

function fromRow(row: CampaignRow): Campaign {
  return {
    id: row.id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description,
    location: row.location,
    pathKey: row.path_key,
    status: row.status,
    suggestions: row.suggestions ?? [],
    createdAt: row.created_at,
  };
}

export async function createCampaign(input: {
  title: string;
  description: string;
  location?: string;
  pathKey?: string | null;
}): Promise<Campaign> {
  if (!supabase) throw new Error("supabase not configured");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("must be signed in to start a campaign");

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      creator_id: user.id,
      title: input.title,
      description: input.description,
      location: input.location ?? null,
      path_key: input.pathKey ?? null,
      status: "draft",
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as CampaignRow);
}

export async function generateCampaignSuggestions(campaign: {
  title: string;
  description: string;
  location?: string | null;
}): Promise<CampaignSuggestion[]> {
  const res = await fetch("/api/campaigns/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: campaign.title,
      description: campaign.description,
      location: campaign.location,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "failed to generate suggestions");
  return body.suggestions as CampaignSuggestion[];
}

export async function saveCampaignSuggestions(
  campaignId: string,
  suggestions: CampaignSuggestion[]
): Promise<void> {
  if (!supabase) throw new Error("supabase not configured");
  const { error } = await supabase
    .from("campaigns")
    .update({ suggestions, status: "active" })
    .eq("id", campaignId);
  if (error) throw error;
}

export async function listActiveCampaigns(): Promise<Campaign[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as CampaignRow[]).map(fromRow);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as CampaignRow) : null;
}
