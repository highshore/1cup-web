"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  ShadowAdminLesson,
  ShadowDifficulty,
  loadAdminShadowLessons,
  publishShadowLesson,
  queueShadowLesson,
} from "../../lib/features/shadow/services/shadow_lesson_service";

const wrapperClass =
  "flex max-w-[1100px] mx-auto pt-0 px-5 pb-10 flex-col gap-6";

const headerClass = "mt-2";

const eyebrowClass =
  "mx-0 mt-0 mb-1.5 text-[#e0602e] text-[12px] font-black tracking-[0.09em] uppercase";

const titleClass = "m-0 text-[#050505] text-[28px] font-black";

const descriptionClass =
  "max-w-[760px] mx-0 mt-2 mb-0 text-[rgba(5,5,5,0.65)] font-semibold leading-[1.55]";

const panelClass =
  "p-[22px] border-[3px] border-[#050505] rounded-2xl bg-white shadow-[6px_6px_0_rgba(5,5,5,0.9)]";

const panelTitleClass = "m-0 text-[#050505] text-[18px] font-black";

const panelDescriptionClass =
  "max-w-[800px] mx-0 mt-2 mb-[18px] text-[rgba(5,5,5,0.64)] text-[14px] font-semibold leading-[1.5]";

const formGridClass =
  "grid grid-cols-[2fr_repeat(3,minmax(130px,1fr))_auto] gap-2.5 items-end max-[850px]:grid-cols-2 max-[520px]:grid-cols-1";

const fieldClass =
  "flex flex-col gap-1.5 text-[#050505] text-[12px] font-black";

const inputClass =
  "min-w-0 py-2.5 px-[11px] border-[1.5px] border-[#050505] rounded-lg bg-white text-[#050505] [font:inherit] focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#e0602e] focus-visible:outline-offset-2";

const selectClass =
  "min-w-0 py-2.5 px-[11px] border-[1.5px] border-[#050505] rounded-lg bg-white text-[#050505] [font:inherit]";

const buttonBaseClass =
  "min-h-10 py-2.5 px-3.5 border-2 border-[#050505] rounded-lg text-[#050505] cursor-pointer text-[13px] font-black transition-[translate,box-shadow] duration-[140ms] ease-[ease] hover:enabled:-translate-x-px hover:enabled:-translate-y-px hover:enabled:shadow-[3px_3px_0_#050505] focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#e0602e] focus-visible:outline-offset-[3px] disabled:cursor-default disabled:opacity-60";

const buttonClass = `${buttonBaseClass} bg-[#e0602e]`;

const secondaryButtonClass = `${buttonBaseClass} bg-white`;

const noticeClass = (error?: boolean) =>
  `mx-0 mt-3.5 mb-0 text-[13px] font-extrabold ${
    error ? "text-[#b42318]" : "text-[#176a3a]"
  }`;

const lessonListClass = "flex flex-col gap-2.5";

const lessonCardClass =
  "flex gap-4 items-start justify-between p-[15px] border-[1.5px] border-[#050505] rounded-[10px] max-[680px]:flex-col";

const lessonMainClass = "min-w-0";

const lessonTitleClass =
  "[overflow-wrap:anywhere] m-0 text-[#050505] text-[15px] font-black";

const lessonUrlClass =
  "[overflow-wrap:anywhere] mx-0 mt-[5px] mb-0 text-[rgba(5,5,5,0.55)] text-[12px] font-semibold";

const metaClass = "flex flex-wrap gap-[7px] mt-2.5";

const badgeClass = (tone: "orange" | "green" | "red" | "gray") =>
  `py-1 px-[7px] rounded-full text-[#050505] text-[11px] font-black ${
    tone === "green"
      ? "bg-[#dff6e6]"
      : tone === "red"
      ? "bg-[#fee4e2]"
      : tone === "orange"
      ? "bg-[#ffe0d2]"
      : "bg-[#f1f1f1]"
  }`;

const errorDetailClass =
  "mx-0 mt-[9px] mb-0 text-[#b42318] text-[12px] font-bold leading-[1.45]";

const actionsClass = "flex flex-none flex-wrap gap-2";

const loadingClass = "p-10 text-[rgba(5,5,5,0.62)] font-extrabold text-center";

function formatDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminShadowClient() {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const { t, locale } = useI18n();
  const copy = t.admin.shadow;
  const [authorized, setAuthorized] = useState(false);
  const [lessons, setLessons] = useState<ShadowAdminLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [category, setCategory] = useState("general");
  const [difficulty, setDifficulty] = useState<ShadowDifficulty>("intermediate");
  const [captionLanguage, setCaptionLanguage] = useState("en");
  const [submitting, setSubmitting] = useState(false);
  const [actionLessonId, setActionLessonId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    if (accountStatus !== "admin") {
      router.replace("/");
      return;
    }
    setAuthorized(true);
  }, [accountStatus, authLoading, currentUser, router]);

  const load = useCallback(async () => {
    try {
      setLessons(await loadAdminShadowLessons());
    } catch (error) {
      console.error("Unable to load admin shadow lessons:", error);
      setNotice({ text: copy.loadError, error: true });
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    if (!authorized) return;
    void load();
  }, [authorized, load]);

  const hasActiveProcessing = useMemo(
    () => lessons.some((lesson) => lesson.job?.status === "queued" || lesson.job?.status === "processing"),
    [lessons],
  );

  useEffect(() => {
    if (!authorized || !hasActiveProcessing) return;
    const interval = window.setInterval(() => void load(), 4_000);
    return () => window.clearInterval(interval);
  }, [authorized, hasActiveProcessing, load]);

  const queue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);
    try {
      await queueShadowLesson({ youtubeUrl, category, difficulty, captionLanguage });
      setYoutubeUrl("");
      setNotice({ text: copy.queued });
      await load();
    } catch (error) {
      console.error("Unable to queue shadow lesson:", error);
      setNotice({ text: copy.queueError, error: true });
    } finally {
      setSubmitting(false);
    }
  };

  const retry = async (lesson: ShadowAdminLesson) => {
    setNotice(null);
    setActionLessonId(lesson.id);
    try {
      await queueShadowLesson({
        action: "retry",
        youtubeUrl: lesson.youtubeUrl,
        category: lesson.category,
        difficulty: lesson.difficulty,
        captionLanguage: "en",
      });
      setNotice({ text: copy.queued });
      await load();
    } catch (error) {
      console.error("Unable to retry shadow lesson:", error);
      setNotice({ text: copy.queueError, error: true });
    } finally {
      setActionLessonId(null);
    }
  };

  const publish = async (lessonId: string) => {
    setNotice(null);
    setActionLessonId(lessonId);
    try {
      await publishShadowLesson(lessonId);
      setNotice({ text: copy.published });
      await load();
    } catch (error) {
      console.error("Unable to publish shadow lesson:", error);
      setNotice({ text: copy.queueError, error: true });
    } finally {
      setActionLessonId(null);
    }
  };

  if (authLoading || !authorized) return <div className={loadingClass}>{t.admin.dashboard.loading}</div>;

  return (
    <main className={wrapperClass}>
      <header className={headerClass}>
        <p className={eyebrowClass}>{copy.eyebrow}</p>
        <h1 className={titleClass}>{copy.pageTitle}</h1>
        <p className={descriptionClass}>{copy.pageDescription}</p>
      </header>

      <section className={panelClass}>
        <h2 className={panelTitleClass}>{copy.queueTitle}</h2>
        <p className={panelDescriptionClass}>{copy.queueDescription}</p>
        <form className={formGridClass} onSubmit={queue}>
          <label className={fieldClass}>
            {copy.youtubeUrl}
            <input className={inputClass} value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder={copy.youtubePlaceholder} required type="url" />
          </label>
          <label className={fieldClass}>
            {copy.category}
            <input className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)} placeholder={copy.categoryPlaceholder} maxLength={80} />
          </label>
          <label className={fieldClass}>
            {copy.difficulty}
            <select className={selectClass} value={difficulty} onChange={(event) => setDifficulty(event.target.value as ShadowDifficulty)}>
              <option value="novice">{copy.difficulties.novice}</option>
              <option value="intermediate">{copy.difficulties.intermediate}</option>
              <option value="advanced">{copy.difficulties.advanced}</option>
            </select>
          </label>
          <label className={fieldClass}>
            {copy.captionLanguage}
            <input className={inputClass} value={captionLanguage} onChange={(event) => setCaptionLanguage(event.target.value)} maxLength={8} pattern="[a-z]{2,3}(-[A-Z]{2})?" required />
          </label>
          <button className={buttonClass} type="submit" disabled={submitting}>{submitting ? copy.queueing : copy.queue}</button>
        </form>
        {notice ? <p className={noticeClass(notice.error)}>{notice.text}</p> : null}
      </section>

      <section className={panelClass}>
        <h2 className={panelTitleClass}>{copy.jobsTitle}</h2>
        <p className={panelDescriptionClass}>{copy.pageDescription}</p>
        {loading ? (
          <div className={loadingClass}>{copy.loading}</div>
        ) : lessons.length === 0 ? (
          <div className={loadingClass}>{copy.empty}</div>
        ) : (
          <div className={lessonListClass}>
            {lessons.map((lesson) => {
              const status = lesson.job?.status ?? lesson.publicationStatus;
              const stage = lesson.job?.stage ?? lesson.processing?.stage ?? "queued";
              const tone = status === "published" || status === "ready_for_review" ? "green" : status === "failed" ? "red" : status === "needs_audio_stt" ? "orange" : "gray";
              const formattedDate = formatDate(lesson.updatedAt, locale);
              const isActing = actionLessonId === lesson.id;
              return (
                <article className={lessonCardClass} key={lesson.id}>
                  <div className={lessonMainClass}>
                    <h3 className={lessonTitleClass}>{lesson.title}</h3>
                    <p className={lessonUrlClass}>{lesson.youtubeUrl}</p>
                    <div className={metaClass}>
                      <span className={badgeClass(tone)}>{copy.status[status]}</span>
                      <span className={badgeClass("gray")}>{copy.stages[stage as keyof typeof copy.stages] ?? stage}</span>
                      <span className={badgeClass("gray")}>{lesson.job?.progress ?? lesson.processing?.progress ?? 0}%</span>
                      <span className={badgeClass("gray")}>{copy.difficulties[lesson.difficulty]}</span>
                      {formattedDate ? <span className={badgeClass("gray")}>{copy.updated.replace("{date}", formattedDate)}</span> : null}
                    </div>
                    {lesson.job?.errorMessage ? <p className={errorDetailClass}>{lesson.job.errorMessage}</p> : null}
                  </div>
                  <div className={actionsClass}>
                    {(status === "failed" || status === "needs_audio_stt") ? (
                      <button className={secondaryButtonClass} type="button" onClick={() => void retry(lesson)} disabled={isActing}>
                        {isActing ? copy.retrying : copy.retry}
                      </button>
                    ) : null}
                    {status === "ready_for_review" ? (
                      <button className={buttonClass} type="button" onClick={() => void publish(lesson.id)} disabled={isActing}>
                        {isActing ? copy.publishing : copy.publish}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
