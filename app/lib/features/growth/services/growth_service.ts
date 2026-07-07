import { supabase } from "../../../supabase/client";
import {
  GrowthPost,
  GrowthIteration,
  GrowthConfig,
  GrowthPostStatus,
  DEFAULT_GROWTH_CONFIG,
} from "../types/growth_types";

const POSTS = "growth_posts";
const ITERATIONS = "growth_iterations";
const CONFIG = "growth_config";
const CONFIG_DOC = "settings";

const toDate = (v: any): Date => (v ? new Date(v) : new Date());

const toIso = (v: any): string | null => (v ? new Date(v).toISOString() : null);

const rowToPost = (data: any): GrowthPost => {
  return {
    id: data.id,
    channel: data.channel || "koreapas",
    title: data.title || "",
    content: data.content || "",
    imageUrl: data.image_url || "",
    variant: data.variant || {},
    trackingCode: data.tracking_code || "",
    status: (data.status as GrowthPostStatus) || "draft",
    externalUrl: data.external_url || "",
    iterationId: data.iteration_id || "",
    metrics: {
      impressions: data.metrics?.impressions ?? 0,
      clicks: data.metrics?.clicks ?? 0,
      signups: data.metrics?.signups ?? 0,
      likes: data.metrics?.likes ?? 0,
      comments: data.metrics?.comments ?? 0,
    },
    scheduledFor: toIso(data.scheduled_for),
    postedAt: toIso(data.posted_at),
    createdAt: toDate(data.created_at),
    updatedAt: toDate(data.updated_at),
  };
};

const rowToIteration = (data: any): GrowthIteration => {
  return {
    id: data.id,
    runAt: toDate(data.run_at),
    channel: data.channel || "koreapas",
    observation: data.observation || "",
    decision: data.decision || "",
    strategyChange: data.strategy_change || "",
    variant: data.variant || {},
    postId: data.post_id || "",
    model: data.model || "",
    tokensUsed: data.tokens_used ?? 0,
  };
};

// Short, URL-safe tracking code for a post's /r/<code> link.
const generateTrackingCode = (): string =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

export const fetchGrowthPosts = async (): Promise<GrowthPost[]> => {
  try {
    const { data, error } = await supabase
      .from(POSTS)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToPost);
  } catch (error) {
    console.error("Error fetching growth posts:", error);
    return [];
  }
};

export const fetchGrowthIterations = async (
  max = 50
): Promise<GrowthIteration[]> => {
  try {
    const { data, error } = await supabase
      .from(ITERATIONS)
      .select("*")
      .order("run_at", { ascending: false })
      .limit(max);
    if (error) throw error;
    return (data || []).map(rowToIteration);
  } catch (error) {
    console.error("Error fetching growth iterations:", error);
    return [];
  }
};

export const fetchGrowthConfig = async (): Promise<GrowthConfig> => {
  try {
    const { data, error } = await supabase
      .from(CONFIG)
      .select("*")
      .eq("id", CONFIG_DOC)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ...DEFAULT_GROWTH_CONFIG };
    return {
      agentActive: !!data.agent_active,
      approveFirst: data.approve_first ?? true,
      updatedAt: toDate(data.updated_at),
    };
  } catch (error) {
    console.error("Error fetching growth config:", error);
    return { ...DEFAULT_GROWTH_CONFIG };
  }
};

export const updateGrowthConfig = async (
  partial: Partial<GrowthConfig>
): Promise<void> => {
  const update: any = { id: CONFIG_DOC, updated_at: new Date().toISOString() };
  if (partial.agentActive !== undefined) update.agent_active = partial.agentActive;
  if (partial.approveFirst !== undefined) update.approve_first = partial.approveFirst;
  const { error } = await supabase.from(CONFIG).upsert(update);
  if (error) throw error;
};

export const createGrowthPost = async (
  data: Partial<GrowthPost>
): Promise<string> => {
  const now = new Date().toISOString();
  const post: any = {
    id: crypto.randomUUID(),
    channel: data.channel || "koreapas",
    title: data.title || "",
    content: data.content || "",
    image_url: data.imageUrl || "",
    variant: data.variant || {},
    tracking_code: data.trackingCode || generateTrackingCode(),
    status: data.status || "draft",
    external_url: data.externalUrl || "",
    iteration_id: data.iterationId || "",
    metrics: { clicks: 0, signups: 0 },
    created_at: now,
    updated_at: now,
  };
  const { data: inserted, error } = await supabase
    .from(POSTS)
    .insert(post)
    .select()
    .single();
  if (error) throw error;
  return inserted.id;
};

export const updateGrowthPostStatus = async (
  id: string,
  status: GrowthPostStatus,
  extra?: { externalUrl?: string }
): Promise<void> => {
  const update: any = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "posted") update.posted_at = new Date().toISOString();
  if (extra?.externalUrl !== undefined) update.external_url = extra.externalUrl;
  const { error } = await supabase.from(POSTS).update(update).eq("id", id);
  if (error) throw error;
};

export const deleteGrowthPost = async (id: string): Promise<void> => {
  const { error } = await supabase.from(POSTS).delete().eq("id", id);
  if (error) throw error;
};
