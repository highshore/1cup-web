"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useI18n } from "../lib/i18n/I18nProvider";
import {
  ShadowLesson,
  loadPublishedShadowLessons,
} from "../lib/features/shadow/services/shadow_lesson_service";

const stateClasses =
  "py-12 px-5 border-2 border-dashed border-[rgba(5,5,5,0.3)] rounded-[14px] text-[rgba(5,5,5,0.62)] font-bold leading-[1.6] text-center";

export default function ShadowLibraryClient() {
  const { t } = useI18n();
  const copy = t.shadow.library;
  const [lessons, setLessons] = useState<ShadowLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setLessons(await loadPublishedShadowLessons());
    } catch (error) {
      console.error("Unable to load published shadow lessons:", error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="w-full max-w-page mx-auto pt-10 px-gutter pb-16 max-[640px]:px-gutter-mobile">
      <p className="mt-0 mx-0 mb-[0.55rem] text-[#e0602e] text-[0.78rem] font-black tracking-[0.11em] uppercase">
        {copy.eyebrow}
      </p>
      <h1 className="m-0 text-[#050505] text-[clamp(2rem,5vw,3.25rem)] [font-weight:950] tracking-[-0.055em]">
        {copy.title}
      </h1>
      <p className="max-w-[43rem] mt-4 mx-0 mb-8 text-[rgba(5,5,5,0.65)] text-[1rem] font-semibold leading-[1.7]">
        {copy.description}
      </p>

      {loading ? (
        <div className={stateClasses}>{copy.loading}</div>
      ) : failed ? (
        <div className={stateClasses}>{copy.error}</div>
      ) : lessons.length === 0 ? (
        <div className={stateClasses}>{copy.empty}</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {lessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/shadow/${encodeURIComponent(lesson.id)}`}
              className="flex min-h-[180px] flex-col justify-between p-[1.2rem] border-2 border-solid border-[#050505] rounded-[14px] bg-white shadow-[4px_4px_0_#e0602e] text-[#050505] no-underline [transition:transform_0.16s_ease,box-shadow_0.16s_ease] hover:[transform:translate(-2px,-2px)] hover:shadow-[6px_6px_0_#e0602e] focus-visible:[outline:3px_solid_#e0602e] focus-visible:outline-offset-4"
            >
              <div>
                <span className="text-[#e0602e] text-[0.72rem] font-black tracking-[0.08em] uppercase">
                  {lesson.category}
                </span>
                <h2 className="mt-[1.1rem] mx-0 mb-[0.65rem] text-[1.15rem] font-black leading-[1.35]">
                  {lesson.title}
                </h2>
                {lesson.description ? (
                  <p className="line-clamp-2 m-0 text-[rgba(5,5,5,0.62)] text-[0.86rem] font-semibold leading-[1.5]">
                    {lesson.description}
                  </p>
                ) : null}
              </div>
              <div className="mt-[1.1rem] text-[rgba(5,5,5,0.58)] text-[0.75rem] font-extrabold capitalize">
                {copy.difficulty[lesson.difficulty]}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
