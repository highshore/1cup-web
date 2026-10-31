// Server-only: the daily post lifecycle behind /api/admin/social and the nightly cron.
// draft → (edit / regenerate / reschedule) → approved → the `marketing` Edge Function
// publishes it when due → published | failed. Drafts nobody approves before their time
// are marked expired by the Edge Function.
import { admin } from "../../../supabase/server";
import {
  hasSlides,
  type HookStyle,
  isCarouselContent,
  isThreadContent,
  type SocialChannel,
  type SocialChannelOverview,
  type SocialDailyPost,
  type SocialPostStatus,
  THREAD_MEDIA,
  THREAD_STRUCTURES,
  type ThreadMedia,
  type ThreadStructure,
} from "../types";
import { POST_LINK_CTA, PROFILE_CTA, renderAndStoreSlides } from "./cards";
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
import { chooseSlot, kstSlotOf, scoredPosts, slotStats } from "./slots";
import { chooseVariant, openerLessons, variantStats } from "./variants";

// What has to be rendered: card images for slides, or an MP4 plus its cover image when
// the slides are narrated (an Instagram reel, or a Threads post with a video). Threads
// cards point at the link in the post instead of the profile.
const renderMedia = (postId: string, channel: SocialChannel, content: unknown) => {
  if (!hasSlides(content)) return Promise.resolve([]);
  const cta = channel === "threads" ? POST_LINK_CTA : PROFILE_CTA;
  return Array.isArray(content.narration)
    ? renderAndStoreReel(postId, content.slides, content.narration, cta)
    : renderAndStoreSlides(postId, content.slides, cta);
};

// The rendered part of a post. Saving only re-renders when this changed, so fixing a
// typo in a caption does not rebuild a video.
const visualKey = (content: unknown) =>
  hasSlides(content) ? JSON.stringify([content.slides, content.narration ?? null]) : "";

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
  threadMedia: (row.thread_media as ThreadMedia | null) ?? "",
  threadStructure: (row.thread_structure as ThreadStructure | null) ?? "",
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

// The panel lists only posts that still need something: drafts, approved posts waiting
// for their time, posts being published, recent failures (to retry), and today's or
// tomorrow's rejected or missed post (to rewrite). Published posts leave the list; they
// are in the channel's post history (marketing_cron_runs) with their metrics.
// `takenDates` says whether today and tomorrow already have a post, so the panel does
// not offer to draft a day whose post was already published.
export async function channelOverview(channel: SocialChannel): Promise<SocialChannelOverview> {
  const db = admin();
  const today = kstDate(0);
  const [active, taken, scored] = await Promise.all([
    db
      .from(TABLE)
      .select("*")
      .eq("channel", channel)
      .or(
        `status.in.(draft,approved,publishing),and(status.eq.failed,post_date.gte.${kstDate(-2)}),and(status.in.(rejected,expired),post_date.gte.${today})`,
      )
      .order("post_date", { ascending: false })
      .limit(20),
    db.from(TABLE).select("post_date").eq("channel", channel).in("post_date", [today, kstDate(1)]),
    scoredPosts(channel),
  ]);
  if (active.error) throw new SocialPostError(active.error.message, 500);
  return {
    posts: (active.data ?? []).map((row) => toPost(row as Record<string, unknown>)),
    takenDates: (taken.data ?? []).map((row) => String(row.post_date)),
    slots: slotStats(channel, scored),
    variants: variantStats(channel, scored),
  };
}

const contentText = (content: unknown) =>
  isThreadContent(content) ? content.text : isCarouselContent(content) ? content.slides[0]?.title ?? "" : "";

export const isThreadMedia = (value: unknown): value is ThreadMedia => THREAD_MEDIA.includes(value as ThreadMedia);
export const isThreadStructure = (value: unknown): value is ThreadStructure =>
  THREAD_STRUCTURES.includes(value as ThreadStructure);

export interface GenerateOptions {
  /** Replace an existing draft (rejected, failed and expired posts too). */
  replace?: boolean;
  pillar?: string;
  /** Instagram: "carousel" | "reel". */
  format?: string;
  /** Threads experiments; chosen by the optimizer when left out. */
  threadMedia?: ThreadMedia;
  threadStructure?: ThreadStructure;
}

export async function generateDailyPost(
  channel: SocialChannel,
  postDate: string,
  options: GenerateOptions = {},
): Promise<SocialDailyPost> {
  const db = admin();
  const { data: existing } = await db.from(TABLE).select("*").eq("channel", channel).eq("post_date", postDate).maybeSingle();
  if (existing) {
    if (!options.replace) return toPost(existing as Record<string, unknown>);
    if (!["draft", "rejected", "failed", "expired"].includes(String(existing.status))) {
      throw new SocialPostError("Approved or published posts cannot be regenerated. Move it back to draft first.", 409);
    }
  }

  const pillar = pillarFor(channel, postDate, options.pillar);
  const format = formatFor(channel, postDate, options.format);
  const [material, recent, scored] = await Promise.all([
    loadMaterial(postDate),
    db.from(TABLE).select("content").eq("channel", channel).lt("post_date", postDate).order("post_date", { ascending: false }).limit(7),
    scoredPosts(channel),
  ]);
  const stats = slotStats(channel, scored);
  const variants = variantStats(channel, scored);
  const isThreads = channel === "threads";
  const pick = <K extends string>(manual: K | undefined, experiment: "media" | "structure") =>
    manual ? { key: manual, reason: "manual" as const } : chooseVariant<K>(variants[experiment], postDate, experiment);
  const media = isThreads ? pick<ThreadMedia>(options.threadMedia, "media") : null;
  const structure = isThreads ? pick<ThreadStructure>(options.threadStructure, "structure") : null;
  const threadMedia = media?.key ?? null;
  const threadStructure = structure?.key ?? null;
  const hook = chooseVariant<HookStyle>(variants.hook, postDate, `hook:${channel}`);
  const content = await draftPost(channel, postDate, pillar, material, {
    format,
    hookStyle: hook.key,
    threadMedia: threadMedia ?? undefined,
    threadStructure: threadStructure ?? undefined,
    recentPosts: (recent.data ?? []).map((row) => contentText(row.content)).filter(Boolean),
    lessons: openerLessons(scored),
  });
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
        thread_media: threadMedia,
        thread_structure: threadStructure,
        content,
        media: [],
        source: {
          ...materialSource(material, pillar),
          // Why each experiment landed where it did (explore | best | try | manual).
          variants: { hook: hook.reason, ...(media && structure ? { media: media.reason, structure: structure.reason } : {}) },
        },
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

  if (hasSlides(content)) {
    let media;
    try {
      media = await renderMedia(String(saved.id), channel, content);
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
      row.format === "thread"
        ? normalizeThread(
            raw,
            isThreadMedia(row.thread_media) ? row.thread_media : "text",
            isThreadStructure(row.thread_structure) ? row.thread_structure : undefined,
          )
        : row.format === "reel"
          ? normalizeReel(raw)
          : normalizeCarousel(raw);
    update.content = content;
    const media = Array.isArray(row.media) ? row.media : [];
    if (visualKey(content) !== visualKey(row.content) || (hasSlides(content) && media.length === 0)) {
      update.media = await renderMedia(id, row.channel as SocialChannel, content);
    }
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

// Only what has been rendered can be published: card images for slides, the video for
// narrated slides. A text-only Threads post needs nothing.
function assertMediaReady(row: Record<string, unknown>) {
  const media = (Array.isArray(row.media) ? row.media : []) as Array<{ kind?: string }>;
  const needsVideo = row.format === "reel" || (row.channel === "threads" && row.thread_media === "video");
  if (needsVideo) {
    if (!media.some((item) => item.kind === "video")) {
      throw new SocialPostError("The video is missing. Save the post to render it.", 409);
    }
    return;
  }
  if (row.channel === "threads" && row.thread_media !== "image") return;
  const slides = hasSlides(row.content) ? row.content.slides.length : 0;
  if (!slides || media.length !== slides) throw new SocialPostError("Card images are missing. Save the post to render them.", 409);
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
  if (next === "approved") assertMediaReady(row);
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

// "Publish now": approve with the time set to now, then run the publisher's scheduler
// tick right away instead of waiting up to five minutes for pg_cron. The tick publishes
// the oldest due approved post, which is this one unless another run holds the lease;
// then the next tick picks it up. Waits for the publish (a reel can take ~2 minutes).
export async function publishDailyPostNow(id: string, adminUid: string): Promise<SocialDailyPost> {
  const row = await getRow(id);
  if (!EDITABLE.includes(row.status as SocialPostStatus)) {
    throw new SocialPostError("This post is publishing or already published.", 409);
  }
  assertMediaReady(row);
  const now = new Date().toISOString();
  const { error } = await admin()
    .from(TABLE)
    .update({
      status: "approved",
      approved_at: now,
      approved_by: adminUid,
      scheduled_for: now,
      slot: kstSlotOf(now),
      slot_reason: "manual",
      error: "",
      updated_at: now,
    })
    .eq("id", id);
  if (error) throw new SocialPostError(error.message, 500);

  const db = admin();
  const { data: secret, error: secretError } = await db.rpc("marketing_scheduler_secret");
  if (secretError || typeof secret !== "string" || !secret) {
    // Still approved and due: the regular tick publishes it within five minutes.
    console.error("[social] publish-now could not read the scheduler secret", secretError);
  } else {
    const { error: invokeError } = await db.functions.invoke("marketing", {
      body: { action: "tick" },
      headers: { "x-marketing-scheduler-secret": secret },
    });
    if (invokeError) console.error("[social] publish-now tick failed", invokeError);
  }
  return toPost(await getRow(id));
}

// Nightly: draft tomorrow's posts for both channels. Existing drafts are left alone, so
// a re-run (or Vercel retrying the cron) costs nothing. The channels draft in parallel:
// on a day when both build a video, one after the other could run past the function's
// five-minute limit.
export async function generateUpcomingDrafts(): Promise<Record<string, string>> {
  const postDate = kstDate(1);
  const channels: SocialChannel[] = ["threads", "instagram"];
  const outcomes = await Promise.all(
    channels.map(async (channel) => {
      try {
        const post = await generateDailyPost(channel, postDate);
        return `${post.status} ${post.id}`;
      } catch (error) {
        console.error(`[social-drafts] ${channel} ${postDate} failed`, error);
        return `failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }),
  );
  return Object.fromEntries(channels.map((channel, index) => [channel, outcomes[index]]));
}
