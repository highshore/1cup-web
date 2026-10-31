"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  PaperAirplaneIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { useI18n } from "../../../i18n/I18nProvider";
import {
  fetchSocialOverview,
  generateSocialPost,
  publishSocialPostNow,
  saveSocialPost,
  setSocialPostStatus,
} from "../services/social_admin_client";
import {
  type CardSlide,
  CAROUSEL_CAPTION_LIMIT,
  CAROUSEL_MAX_SLIDES,
  type CarouselContent,
  isCarouselContent,
  isReelContent,
  NARRATION_LINE_LIMIT,
  REEL_MAX_SLIDES,
  type ReelContent,
  isThreadContent,
  type SlotStat,
  type SocialChannel,
  type SocialDailyPost,
  type SocialPostStatus,
  SOCIAL_PILLARS,
  THREAD_MAX_REPLIES,
  THREAD_REPLY_LIMIT,
  THREAD_TEXT_LIMIT,
  type ThreadContent,
} from "../types";

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);

const kstDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(Date.now() + offsetDays * 86_400_000));

// <input type="datetime-local"> works in the browser's zone; posts are planned in KST.
const toKstInput = (iso: string | null) => {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
};
const fromKstInput = (value: string) => new Date(`${value}:00+09:00`).toISOString();

const cardClass =
  "rounded-2xl border-[3px] border-[#050505] bg-white p-6 shadow-[6px_6px_0_rgba(5,5,5,0.9)] max-[620px]:p-4";
const buttonClass =
  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-[#050505] px-3 py-1.5 text-[12px] font-black text-[#050505] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a]";
const inputClass =
  "w-full rounded-lg border-[1.5px] border-[#050505] bg-white px-3 py-2 text-[14px] leading-[1.55] text-[#050505] focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a]";
const labelClass = "grid gap-1.5 text-[12px] font-black text-[#050505]";
const mutedClass = "text-[12px] font-semibold text-[rgba(5,5,5,0.6)]";

const STATUS_TONE: Record<SocialPostStatus, string> = {
  draft: "bg-[#fff1e9] text-[#b6531f]",
  approved: "bg-[#e6f2e9] text-[#3f7a50]",
  rejected: "bg-[#f1efec] text-[#706a64]",
  publishing: "bg-[#fff1e9] text-[#b6531f]",
  published: "bg-[#e6f2e9] text-[#3f7a50]",
  failed: "bg-[#f8e4e2] text-[#b9473f]",
  expired: "bg-[#f1efec] text-[#706a64]",
};

const EDITABLE: SocialPostStatus[] = ["draft", "approved", "rejected", "failed", "expired"];

type DailyCopy = ReturnType<typeof useI18n>["t"]["admin"]["social"]["daily"];

export default function DailyPostsPanel({ channel }: { channel: SocialChannel }) {
  const { t } = useI18n();
  const copy = t.admin.social.daily;
  const [posts, setPosts] = useState<SocialDailyPost[]>([]);
  const [slots, setSlots] = useState<SlotStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [theme, setTheme] = useState("");
  const [format, setFormat] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const overview = await fetchSocialOverview(channel);
      setPosts(overview.posts);
      setSlots(overview.slots);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    void load();
  }, [load]);

  const replacePost = (next: SocialDailyPost) =>
    setPosts((current) =>
      [next, ...current.filter((post) => post.id !== next.id)].sort((a, b) => b.postDate.localeCompare(a.postDate)),
    );

  const generate = async (postDate: string, replace = false, pillar = theme, postFormat = format) => {
    setGenerating(postDate);
    setError("");
    try {
      replacePost(await generateSocialPost(channel, postDate, replace, pillar || undefined, postFormat || undefined));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setGenerating(null);
    }
  };

  const today = kstDate(0);
  const tomorrow = kstDate(1);
  const has = (postDate: string) => posts.some((post) => post.postDate === postDate);
  const best = slots
    .filter((slot) => slot.medianViews24h !== null)
    .sort((a, b) => (b.medianViews24h ?? 0) - (a.medianViews24h ?? 0))[0]?.slot;

  return (
    <section className={cardClass} aria-labelledby={`${channel}-daily`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[760px]">
          <h2 id={`${channel}-daily`} className="m-0 flex items-center gap-2 text-[20px] font-black text-[#050505]">
            <SparklesIcon width={20} /> {copy.title}
          </h2>
          <p className="mx-0 mt-1.5 mb-0 text-[13px] font-semibold leading-[1.6] text-[rgba(5,5,5,0.64)]">
            {copy.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(!has(today) || !has(tomorrow)) && (
            <>
              <ThemeSelect copy={copy} value={theme} onChange={setTheme} disabled={generating !== null} />
              {channel === "instagram" && (
                <FormatSelect copy={copy} value={format} onChange={setFormat} disabled={generating !== null} />
              )}
            </>
          )}
          {[
            [today, copy.generateToday],
            [tomorrow, copy.generateTomorrow],
          ]
            .filter(([postDate]) => !has(postDate))
            .map(([postDate, label]) => (
              <button
                key={postDate}
                type="button"
                className={`${buttonClass} bg-[#f47a4a]`}
                disabled={generating !== null}
                onClick={() => void generate(postDate)}
              >
                {generating === postDate ? <ArrowPathIcon width={15} className="animate-spin" /> : <PlusIcon width={15} />}
                {generating === postDate ? copy.generating : label}
              </button>
            ))}
        </div>
      </div>

      {error && <p className="m-0 mt-3 text-[13px] font-bold text-[#b9473f]">{fill(copy.error, { message: error })}</p>}

      <div className="mt-5 grid gap-4">
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-[#f1f0ed]" />
        ) : posts.length === 0 ? (
          <p className={`m-0 ${mutedClass}`}>{copy.empty}</p>
        ) : (
          posts.map((post) => (
            <DailyPostCard
              key={`${post.id}-${post.updatedAt}`}
              post={post}
              copy={copy}
              regenerating={generating === post.postDate}
              onRegenerate={(pillar, postFormat) => {
                if (window.confirm(copy.regenerateConfirm)) void generate(post.postDate, true, pillar, postFormat);
              }}
              onChange={replacePost}
              onError={setError}
            />
          ))
        )}
      </div>

      <details className="mt-5 rounded-xl border-2 border-[#050505] p-4">
        <summary className="cursor-pointer text-[14px] font-black text-[#050505]">{copy.timesTitle}</summary>
        <p className="mx-0 mt-2 mb-3 text-[13px] font-semibold leading-[1.6] text-[rgba(5,5,5,0.64)]">
          {copy.timesDescription}
        </p>
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b-2 border-[#050505]">
              <th className="py-1.5 font-black">{copy.timeSlot}</th>
              <th className="py-1.5 font-black">{copy.samples}</th>
              <th className="py-1.5 font-black">{copy.medianViews}</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.slot} className="border-b border-[#e7e3de]">
                <td className="py-1.5 font-bold">
                  {slot.slot}
                  {slot.slot === best && (
                    <span className="ml-2 rounded-full bg-[#f47a4a] px-2 py-0.5 text-[11px] font-black">{copy.best}</span>
                  )}
                </td>
                <td className="py-1.5">{slot.samples}</td>
                <td className="py-1.5">{slot.medianViews24h === null ? "—" : Math.round(slot.medianViews24h).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function ThemeSelect({
  copy,
  value,
  onChange,
  disabled,
}: {
  copy: DailyCopy;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={copy.theme}
      className="min-h-9 rounded-lg border-[1.5px] border-[#050505] bg-white px-2.5 py-1.5 text-[12px] font-black text-[#050505]"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{copy.themeAuto}</option>
      {SOCIAL_PILLARS.map((pillar) => (
        <option key={pillar} value={pillar}>
          {copy.pillars[pillar]}
        </option>
      ))}
    </select>
  );
}

function FormatSelect({
  copy,
  value,
  onChange,
  disabled,
}: {
  copy: DailyCopy;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={copy.format}
      className="min-h-9 rounded-lg border-[1.5px] border-[#050505] bg-white px-2.5 py-1.5 text-[12px] font-black text-[#050505]"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{copy.formatAuto}</option>
      <option value="carousel">{copy.formats.carousel}</option>
      <option value="reel">{copy.formats.reel}</option>
    </select>
  );
}

function DailyPostCard({
  post,
  copy,
  regenerating,
  onRegenerate,
  onChange,
  onError,
}: {
  post: SocialDailyPost;
  copy: DailyCopy;
  regenerating: boolean;
  onRegenerate: (pillar: string, format: string) => void;
  onChange: (post: SocialDailyPost) => void;
  onError: (message: string) => void;
}) {
  const [thread, setThread] = useState<ThreadContent | null>(isThreadContent(post.content) ? post.content : null);
  // A reel is edited like a carousel, plus one narration line per slide.
  const [carousel, setCarousel] = useState<CarouselContent | ReelContent | null>(
    isCarouselContent(post.content) ? post.content : null,
  );
  const narration = carousel && isReelContent(carousel) ? carousel.narration : null;
  const video = post.media.find((item) => item.kind === "video");
  const [time, setTime] = useState(toKstInput(post.scheduledFor));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [nextTheme, setNextTheme] = useState(post.pillar);
  const [nextFormat, setNextFormat] = useState(post.format === "thread" ? "" : post.format);

  const editable = EDITABLE.includes(post.status);
  const timeChanged = time !== toKstInput(post.scheduledFor);
  const late = post.scheduledFor ? new Date(post.scheduledFor).getTime() < Date.now() : false;
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${post.postDate}T12:00:00Z`),
  );

  const run = async (label: string, work: () => Promise<SocialDailyPost>) => {
    setBusy(label);
    onError("");
    try {
      onChange(await work());
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", () =>
      saveSocialPost(post.id, {
        ...(dirty ? { content: thread ?? carousel } : {}),
        ...(timeChanged && time ? { scheduledFor: fromKstInput(time) } : {}),
      }),
    );

  const updateThread = (next: ThreadContent) => {
    setThread(next);
    setDirty(true);
  };
  const updateNarration = (index: number, value: string) => {
    if (!carousel || !isReelContent(carousel)) return;
    setCarousel({ ...carousel, narration: carousel.narration.map((line, i) => (i === index ? value : line)) });
    setDirty(true);
  };
  const updateSlide = (index: number, key: keyof CardSlide, value: string) => {
    if (!carousel) return;
    setCarousel({ ...carousel, slides: carousel.slides.map((slide, i) => (i === index ? { ...slide, [key]: value } : slide)) });
    setDirty(true);
  };

  return (
    <article className="grid gap-3 rounded-xl border-2 border-[#050505] p-4">
      <header className="flex flex-wrap items-center gap-2">
        <strong className="text-[15px] font-black text-[#050505]">
          {post.postDate} ({weekday})
        </strong>
        <span className="rounded-full border-[1.5px] border-[#050505] px-2.5 py-0.5 text-[12px] font-black">
          {copy.pillars[post.pillar as keyof DailyCopy["pillars"]] ?? post.pillar}
        </span>
        {post.format !== "thread" && (
          <span className="rounded-full border-[1.5px] border-[#050505] bg-[#fff1e9] px-2.5 py-0.5 text-[12px] font-black">
            {copy.formats[post.format as "carousel" | "reel"]}
          </span>
        )}
        <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-black ${STATUS_TONE[post.status]}`}>
          {copy.status[post.status]}
        </span>
        {post.slotReason && (
          <span className={mutedClass}>· {copy.slotReason[post.slotReason]}</span>
        )}
      </header>

      {post.error && <p className="m-0 text-[13px] font-bold text-[#b9473f]">{post.error}</p>}

      <label className={`${labelClass} max-w-[280px]`}>
        {copy.postTime}
        <input
          type="datetime-local"
          className={inputClass}
          value={time}
          disabled={!editable}
          onChange={(event) => setTime(event.target.value)}
        />
      </label>
      {editable && post.status !== "approved" && late && <p className={`m-0 ${mutedClass}`}>{copy.lateApproval}</p>}

      {thread && (
        <div className="grid gap-3">
          <label className={labelClass}>
            {copy.mainText}
            <textarea
              className={`${inputClass} min-h-[110px]`}
              value={thread.text}
              maxLength={THREAD_TEXT_LIMIT}
              disabled={!editable}
              onChange={(event) => updateThread({ ...thread, text: event.target.value })}
            />
            <span className={mutedClass}>{fill(copy.characters, { count: thread.text.length, limit: THREAD_TEXT_LIMIT })}</span>
          </label>
          {thread.replies.map((reply, index) => (
            <label key={index} className={`${labelClass} border-l-4 border-[#f47a4a] pl-3`}>
              <span className="flex items-center justify-between">
                {fill(copy.reply, { n: index + 1 })}
                {editable && (
                  <button
                    type="button"
                    className={`${buttonClass} min-h-7 bg-white`}
                    onClick={() => updateThread({ ...thread, replies: thread.replies.filter((_, i) => i !== index) })}
                  >
                    <TrashIcon width={13} /> {copy.removeReply}
                  </button>
                )}
              </span>
              <textarea
                className={`${inputClass} min-h-[90px]`}
                value={reply}
                maxLength={THREAD_REPLY_LIMIT}
                disabled={!editable}
                onChange={(event) =>
                  updateThread({ ...thread, replies: thread.replies.map((item, i) => (i === index ? event.target.value : item)) })
                }
              />
              <span className={mutedClass}>{fill(copy.characters, { count: reply.length, limit: THREAD_REPLY_LIMIT })}</span>
            </label>
          ))}
          {editable && thread.replies.length < THREAD_MAX_REPLIES && (
            <button
              type="button"
              className={`${buttonClass} w-fit bg-white`}
              onClick={() => updateThread({ ...thread, replies: [...thread.replies, ""] })}
            >
              <PlusIcon width={14} /> {copy.addReply}
            </button>
          )}
          <p className={`m-0 ${mutedClass}`}>{copy.linkNote}</p>
        </div>
      )}

      {carousel && (
        <div className="grid gap-3">
          {video ? (
            <video
              src={video.url}
              poster={post.media.find((item) => item.kind === "image")?.url}
              controls
              playsInline
              preload="metadata"
              className="h-[420px] w-[236px] rounded-lg border-[1.5px] border-[#050505] bg-[#050505] object-contain"
            />
          ) : post.media.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {post.media.map((item, index) => (
                <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="flex-none">
                  <img
                    src={item.url}
                    alt={fill(copy.slide, { n: index + 1 })}
                    className="h-[200px] w-[160px] rounded-lg border-[1.5px] border-[#050505] object-cover"
                  />
                </a>
              ))}
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-[13px] font-black text-[#050505]">
              {narration ? copy.scenes : copy.slides} ({carousel.slides.length}/{narration ? REEL_MAX_SLIDES : CAROUSEL_MAX_SLIDES})
            </summary>
            <div className="mt-3 grid gap-3">
              {carousel.slides.map((slide, index) => (
                <fieldset key={index} className="grid gap-2 rounded-lg border-[1.5px] border-[rgba(5,5,5,0.3)] p-3">
                  <legend className="px-1 text-[12px] font-black">{fill(copy.slide, { n: index + 1 })}</legend>
                  <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-2 max-[620px]:grid-cols-1">
                    <label className={labelClass}>
                      {copy.eyebrow}
                      <input className={inputClass} value={slide.eyebrow} maxLength={30} disabled={!editable} onChange={(event) => updateSlide(index, "eyebrow", event.target.value)} />
                    </label>
                    <label className={labelClass}>
                      {copy.slideTitle}
                      <input className={inputClass} value={slide.title} maxLength={60} disabled={!editable} onChange={(event) => updateSlide(index, "title", event.target.value)} />
                    </label>
                  </div>
                  <label className={labelClass}>
                    {copy.slideBody}
                    <textarea className={`${inputClass} min-h-[64px]`} value={slide.body} maxLength={220} disabled={!editable} onChange={(event) => updateSlide(index, "body", event.target.value)} />
                  </label>
                  <label className={labelClass}>
                    {copy.highlight}
                    <input className={inputClass} value={slide.highlight} maxLength={140} disabled={!editable} onChange={(event) => updateSlide(index, "highlight", event.target.value)} />
                  </label>
                  {narration && (
                    <label className={labelClass}>
                      {copy.narration}
                      <textarea
                        className={`${inputClass} min-h-[64px] border-[#f47a4a]`}
                        value={narration[index] ?? ""}
                        maxLength={NARRATION_LINE_LIMIT}
                        disabled={!editable}
                        onChange={(event) => updateNarration(index, event.target.value)}
                      />
                      <span className={mutedClass}>
                        {fill(copy.characters, { count: (narration[index] ?? "").length, limit: NARRATION_LINE_LIMIT })}
                      </span>
                    </label>
                  )}
                </fieldset>
              ))}
            </div>
          </details>
          <label className={labelClass}>
            {copy.caption}
            <textarea
              className={`${inputClass} min-h-[140px]`}
              value={carousel.caption}
              maxLength={CAROUSEL_CAPTION_LIMIT}
              disabled={!editable}
              onChange={(event) => {
                setCarousel({ ...carousel, caption: event.target.value });
                setDirty(true);
              }}
            />
            <span className={mutedClass}>
              {fill(copy.characters, { count: carousel.caption.length, limit: CAROUSEL_CAPTION_LIMIT })}
            </span>
          </label>
          <p className={`m-0 ${mutedClass}`}>{copy.igLinkNote}</p>
        </div>
      )}

      <footer className="flex flex-wrap gap-2">
        {editable && (dirty || timeChanged) && (
          <button type="button" className={`${buttonClass} bg-white`} disabled={busy !== null} onClick={() => void save()}>
            {busy === "save" ? <ArrowPathIcon width={14} className="animate-spin" /> : <CheckIcon width={14} />}
            {busy === "save"
              ? narration && dirty
                ? copy.renderingReel
                : copy.saving
              : narration && dirty
                ? copy.saveAndRenderReel
                : carousel && dirty
                  ? copy.saveAndRender
                  : copy.save}
          </button>
        )}
        {["draft", "rejected", "failed", "expired"].includes(post.status) && !dirty && !timeChanged && (
          <button
            type="button"
            className={`${buttonClass} bg-[#f47a4a]`}
            disabled={busy !== null || late}
            title={late ? copy.lateApproval : undefined}
            onClick={() => void run("approve", () => setSocialPostStatus(post.id, "approve"))}
          >
            <CheckIcon width={14} /> {copy.approveScheduled}
          </button>
        )}
        {["draft", "approved", "rejected", "failed", "expired"].includes(post.status) && !dirty && !timeChanged && (
          <button
            type="button"
            className={`${buttonClass} bg-[#050505] text-white`}
            disabled={busy !== null}
            onClick={() => {
              if (window.confirm(copy.publishNowConfirm)) void run("publish", () => publishSocialPostNow(post.id));
            }}
          >
            {busy === "publish" ? <ArrowPathIcon width={14} className="animate-spin" /> : <PaperAirplaneIcon width={14} />}
            {busy === "publish" ? copy.publishingNow : copy.publishNow}
          </button>
        )}
        {post.status === "approved" && (
          <button
            type="button"
            className={`${buttonClass} bg-white`}
            disabled={busy !== null}
            onClick={() => void run("unapprove", () => setSocialPostStatus(post.id, "unapprove"))}
          >
            {copy.unapprove}
          </button>
        )}
        {["draft", "approved"].includes(post.status) && (
          <button
            type="button"
            className={`${buttonClass} bg-white`}
            disabled={busy !== null}
            onClick={() => void run("reject", () => setSocialPostStatus(post.id, "reject"))}
          >
            <XMarkIcon width={14} /> {copy.reject}
          </button>
        )}
        {["draft", "rejected", "failed", "expired"].includes(post.status) && (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <ThemeSelect copy={copy} value={nextTheme} onChange={setNextTheme} disabled={busy !== null || regenerating} />
            {post.channel === "instagram" && (
              <FormatSelect copy={copy} value={nextFormat} onChange={setNextFormat} disabled={busy !== null || regenerating} />
            )}
            <button
              type="button"
              className={`${buttonClass} bg-white`}
              disabled={busy !== null || regenerating}
              onClick={() => onRegenerate(nextTheme, nextFormat)}
            >
              <ArrowPathIcon width={14} className={regenerating ? "animate-spin" : ""} /> {copy.regenerate}
            </button>
          </span>
        )}
        {post.externalUrl && (
          <a href={post.externalUrl} target="_blank" rel="noopener noreferrer" className={`${buttonClass} bg-white no-underline`}>
            <ArrowTopRightOnSquareIcon width={14} /> {copy.viewPost}
          </a>
        )}
      </footer>
    </article>
  );
}
