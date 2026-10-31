// Browser helpers for /api/admin/social (daily Threads / Instagram posts).
import type { SocialChannel, SocialChannelOverview, SocialDailyPost } from "../types";

async function call<T>(init: RequestInit & { query?: string }): Promise<T> {
  const { query, ...rest } = init;
  const response = await fetch(`/api/admin/social${query ?? ""}`, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
    credentials: "same-origin",
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

export const fetchSocialOverview = (channel: SocialChannel) =>
  call<SocialChannelOverview>({ method: "GET", query: `?channel=${channel}` });

const post = (body: Record<string, unknown>) =>
  call<SocialDailyPost>({ method: "POST", body: JSON.stringify(body) });

export const generateSocialPost = (
  channel: SocialChannel,
  postDate: string,
  replace = false,
  pillar?: string,
  format?: string,
) => post({ action: "generate", channel, postDate, replace, ...(pillar ? { pillar } : {}), ...(format ? { format } : {}) });

export const saveSocialPost = (id: string, changes: { content?: unknown; scheduledFor?: string }) =>
  post({ action: "save", id, ...changes });

export const setSocialPostStatus = (id: string, action: "approve" | "reject" | "unapprove") => post({ action, id });
