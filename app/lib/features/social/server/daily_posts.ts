// Server-only: the daily post lifecycle behind /api/admin/social and the nightly cron.
// draft → (edit / regenerate / reschedule) → approved → the `marketing` Edge Function
// publishes it when due → published | failed. Drafts nobody approves before their time
// are marked expired by the Edge Function.
import { admin } from "../../../supabase/server";
import {
  type CarouselContent,
  isCarouselContent,
  isReelContent,
  isThreadContent,
  type SocialChannel,
  type SocialChannelOverview,
  type SocialDailyPost,
  type SocialPostStatus,
  type ThreadContent,
} from "../types";
import { renderAndStoreSlides } from "./cards";
import {
  draftPost,
  formatFor,
  loadMaterial,
  materialSource,
  normalizeCarousel,
  normalizeReel,
  normalizeThread,
  pillarFor,
} from "./content";
import { renderAndStoreReel } from "./reel";

// Card images for a carousel; the MP4 plus its cover image for a reel.
const renderMedia = (postId: string, content: unknown) =>
  isReelContent(content)
    ? renderAndStoreReel(postId, content.slides, content.narration)
    : isCarouselContent(content)
      ? renderAndStoreSlides(postId, content.slides)
      : Promise.resolve([]);
import { chooseSlot, kstSlotOf, slotStats } from "./slots";

const TABLE = "social_daily_posts";
const EDITABLE: SocialPostStatus[] = ["draft", "approved", "rejected", "failed", "expired"];

export class SocialPostError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const kstDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(Date.now() + offsetDays * 86_400_000));

export const isPostDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

const toPost = (row: Record<string, unknown>): SocialDailyPost => ({
  id: String(row.id),
  channel: row.channel as SocialChannel,
  format: row.format as SocialDailyPost["format"],
  postDate: String(row.post_date),
  pillar: String(row.pillar ?? ""),
  status: row.status as SocialPostStatus,
  scheduledFor: (row.scheduled_for as string | null) ?? null,
  slot: String(row.slot ?? ""),
  slotReason: (row.slot_reason as SocialDailyPost["slotReason"]) ?? "",
  content: (row.content ?? {}) as SocialDailyPost["content"],
  media: Array.isArray(row.media) ? (row.media as SocialDailyPost["media"]) : [],
  source: (row.source ?? {}) as Record<string, unknown>,
  runId: (row.run_id as string | null) ?? null,
  externalUrl: String(row.external_url ?? ""),
  error: String(row.error ?? ""),
  approvedAt: (row.approved_at as string | null) ?? null,
  publishedAt: (row.published_at as string | null) ?? null,
  updatedAt: String(row.updated_at ?? ""),
});

async function getRow(id: string): Promise<Record<string, unknown>> {
  const { data, error } = await admin().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new SocialPostError(error.message, 500);
  if (!data) throw new SocialPostError("Post not found.", 404);
  return data as Record<string, unknown>;
}

export async function channelOverview(channel: SocialChannel): Promise<SocialChannelOverview> {
  const { data, error } = await admin()
    .from(TABLE)
    .select("*")
    .eq("channel", channel)
    .gte("post_date", kstDate(-7))
    .order("post_date", { ascending: false })
    .limit(14);
  if (error) throw new SocialPostError(error.message, 500);
  return { posts: (data ?? []).map((row) => toPost(row as Record<string, unknown>)), slots: await slotStats(channel) };
}

const contentText = (content: unknown) =>
  isThreadContent(content) ? content.text : isCarouselContent(content) ? content.slides[0]?.title ?? "" : "";

export async function generateDailyPost(
  channel: SocialChannel,
  postDate: string,
  replace = false,
  pillarKey?: string,
  formatOverride?: string,
): Promise<SocialDailyPost> {
  const db = admin();
  const { data: existing } = await db.from(TABLE).select("*").eq("channel", channel).eq("post_date", postDate).maybeSingle();
  if (existing) {
    if (!replace) return toPost(existing as Record<string, unknown>);
    if (!["draft", "rejected", "failed", "expired"].includes(String(existing.status))) {
      throw new SocialPostError("Approved or published posts cannot be regenerated. Move it back to draft first.", 409);
    }
  }

  const pillar = pillarFor(channel, postDate, pillarKey);
  const format = formatFor(channel, postDate, formatOverride);
  const [material, recent, stats] = await Promise.all([
    loadMaterial(postDate),
    db.from(TABLE).select("content").eq("channel", channel).lt("post_date", postDate).order("post_date", { ascending: false }).limit(7),
    slotStats(channel),
  ]);
  const content = await draftPost(
    channel,
    postDate,
    pillar,
    material,
    (recent.data ?? []).map((row) => contentText(row.content)).filter(Boolean),
    format,
  );
  const { slot, reason, scheduledFor } = chooseSlot(channel, postDate, stats);
  const now = new Date().toISOString();

  const { data: saved, error } = await db
    .from(TABLE)
    .upsert(
      {
        ...(existing ? { id: existing.id } : {}),
        channel,
        format,
        post_date: postDate,
        pillar: pillar.key,
        status: "draft",
        scheduled_for: scheduledFor,
        slot,
        slot_reason: reason,
        content,
        media: [],
        source: materialSource(material, pillar),
        error: "",
        approved_at: null,
        approved_by: null,
        updated_at: now,
      },
      { onConflict: "channel,post_date" },
    )
    .select("*")
    .single();
  if (error || !saved) throw new SocialPostError(error?.message ?? "Unable to save the draft.", 500);

  if (isCarouselContent(content)) {
    let media;
    try {
      media = await renderMedia(String(saved.id), content);
    } catch (renderError) {
      // Keep the draft (the text is still useful) and say why there is no media yet.
      const message = renderError instanceof Error ? renderError.message : String(renderError);
      await db.from(TABLE).update({ error: `Media rendering failed: ${message}` }).eq("id", saved.id);
      throw new SocialPostError(`The draft was saved but its media could not be rendered: ${message}`, 502);
    }
    const { data: withMedia, error: mediaError } = await db
      .from(TABLE)
      .update({ media, updated_at: new Date().toISOString() })
      .eq("id", saved.id)
      .select("*")
      .single();
    if (mediaError || !withMedia) throw new SocialPostError(mediaError?.message ?? "Unable to save card images.", 500);
    return toPost(withMedia as Record<string, unknown>);
  }
  return toPost(saved as Record<string, unknown>);
}

// Editing an approved post sends it back to draft, so nothing goes out unreviewed.
export async function saveDailyPost(
  id: string,
  input: { content?: unknown; scheduledFor?: unknown },
): Promise<SocialDailyPost> {
  const row = await getRow(id);
  if (!EDITABLE.includes(row.status as SocialPostStatus)) {
    throw new SocialPostError("This post is publishing or already published.", 409);
  }
  const update: Record<string, unknown> = { status: "draft", approved_at: null, approved_by: null, error: "" };

  if (input.content !== undefined) {
    const raw = (input.content ?? {}) as Record<string, unknown>;
    const content =
      row.format === "thread" ? normalizeThread(raw) : row.format === "reel" ? normalizeReel(raw) : normalizeCarousel(raw);
    update.content = content;
    if (isCarouselContent(content)) update.media = await renderMedia(id, content);
  }
  if (input.scheduledFor !== undefined) {
    const at = typeof input.scheduledFor === "string" ? new Date(input.scheduledFor) : null;
    if (!at || Number.isNaN(at.getTime())) throw new SocialPostError("scheduledFor is invalid.");
    update.scheduled_for = at.toISOString();
    update.slot = kstSlotOf(at.toISOString());
    update.slot_reason = "manual";
  }
  update.updated_at = new Date().toISOString();

  const { data, error } = await admin().from(TABLE).update(update).eq("id", id).select("*").single();
  if (error || !data) throw new SocialPostError(error?.message ?? "Unable to save the post.", 500);
  return toPost(data as Record<string, unknown>);
}

export async function setDailyPostStatus(
  id: string,
  next: "approved" | "rejected" | "draft",
  adminUid: string,
): Promise<SocialDailyPost> {
  const row = await getRow(id);
  if (!EDITABLE.includes(row.status as SocialPostStatus)) {
    throw new SocialPostError("This post is publishing or already published.", 409);
  }
  if (next === "approved" && row.channel === "instagram") {
    const media = (Array.isArray(row.media) ? row.media : []) as Array<{ kind?: string }>;
    if (row.format === "reel") {
      if (!media.some((item) => item.kind === "video")) {
        throw new SocialPostError("The reel video is missing. Save the post to render it.", 409);
      }
    } else {
      const slides = isCarouselContent(row.content) ? row.content.slides.length : 0;
      if (!slides || media.length !== slides) throw new SocialPostError("Card images are missing. Save the post to render them.", 409);
    }
  }
  const { data, error } = await admin()
    .from(TABLE)
    .update({
      status: next,
      approved_at: next === "approved" ? new Date().toISOString() : null,
      approved_by: next === "approved" ? adminUid : null,
      error: "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new SocialPostError(error?.message ?? "Unable to update the post.", 500);
  return toPost(data as Record<string, unknown>);
}

// Nightly: draft tomorrow's posts for both channels. Existing drafts are left alone, so
// a re-run (or Vercel retrying the cron) costs nothing.
export async function generateUpcomingDrafts(): Promise<Record<string, string>> {
  const postDate = kstDate(1);
  const result: Record<string, string> = {};
  for (const channel of ["threads", "instagram"] as SocialChannel[]) {
    try {
      const post = await generateDailyPost(channel, postDate);
      result[channel] = `${post.status} ${post.id}`;
    } catch (error) {
      result[channel] = `failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[social-drafts] ${channel} ${postDate} failed`, error);
    }
  }
  return result;
}
