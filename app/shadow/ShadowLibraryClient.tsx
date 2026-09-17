"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PlayIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

import { useI18n } from "../lib/i18n/I18nProvider";
import {
  ShadowDifficulty,
  ShadowLesson,
  loadPublishedShadowLessons,
} from "../lib/features/shadow/services/shadow_lesson_service";

const stateClasses =
  "py-14 px-5 border-2 border-dashed border-[rgba(5,5,5,0.2)] rounded-[18px] bg-white text-[rgba(5,5,5,0.62)] font-bold leading-[1.6] text-center";

type DifficultyFilter = "all" | ShadowDifficulty;

export default function ShadowLibraryClient() {
  const { t, locale } = useI18n();
  const copy = t.shadow.library;
  const [lessons, setLessons] = useState<ShadowLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [query, setQuery] = useState("");

  const labels =
    locale === "ko"
      ? {
          heroTitle: "보고 듣고 따라 말하며 내 표현으로 만드세요",
          heroDescription:
            "실제 영상의 문장을 이해하고, 구간 반복과 발음 분석으로 끝까지 익히는 쉐도잉 레슨입니다.",
          watch: "영상으로 이해",
          shadow: "문장별 쉐도잉",
          review: "표현 내재화",
          featured: "추천 레슨",
          start: "레슨 시작",
          all: "전체",
          search: "레슨 검색",
          library: "모든 레슨",
          results: "개 레슨",
        }
      : {
          heroTitle: "Watch it. Shadow it. Make it yours.",
          heroDescription:
            "Learn from real video, repeat the exact lines, and turn useful expressions into speech you can actually use.",
          watch: "Understand the clip",
          shadow: "Shadow line by line",
          review: "Internalize expressions",
          featured: "Featured lesson",
          start: "Start lesson",
          all: "All",
          search: "Search lessons",
          library: "All lessons",
          results: "lessons",
        };

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

  const filteredLessons = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return lessons.filter((lesson) => {
      const matchesDifficulty =
        difficulty === "all" || lesson.difficulty === difficulty;
      const matchesQuery =
        !normalizedQuery ||
        lesson.title.toLowerCase().includes(normalizedQuery) ||
        lesson.description.toLowerCase().includes(normalizedQuery) ||
        lesson.category.toLowerCase().includes(normalizedQuery);
      return matchesDifficulty && matchesQuery;
    });
  }, [difficulty, lessons, query]);

  const showFeatured = difficulty === "all" && query.trim() === "";
  const featuredLesson = showFeatured ? filteredLessons[0] : null;
  const gridLessons = featuredLesson
    ? filteredLessons.slice(1)
    : filteredLessons;

  const filters: { value: DifficultyFilter; label: string }[] = [
    { value: "all", label: labels.all },
    { value: "novice", label: copy.difficulty.novice },
    { value: "intermediate", label: copy.difficulty.intermediate },
    { value: "advanced", label: copy.difficulty.advanced },
  ];

  return (
    <main className="min-h-screen bg-[#f7f6f2] pb-20">
      <section className="bg-[#050505] text-white">
        <div className="mx-auto w-full max-w-page px-gutter py-12 max-[640px]:px-gutter-mobile max-[640px]:py-9">
          <p className="m-0 text-[0.74rem] font-black uppercase tracking-[0.14em] text-[#ff6b35]">
            {copy.eyebrow}
          </p>
          <div className="mt-4 grid grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] gap-12 max-[860px]:grid-cols-1 max-[860px]:gap-8">
            <div>
              <h1 className="m-0 max-w-[760px] text-[clamp(2.45rem,6vw,5rem)] font-black leading-[0.98] tracking-[-0.06em]">
                {labels.heroTitle}
              </h1>
              <p className="mt-6 max-w-[680px] text-[clamp(1rem,1.6vw,1.18rem)] font-semibold leading-[1.7] text-white/68">
                {labels.heroDescription}
              </p>
            </div>

            <div className="grid content-end gap-2.5">
              {[
                { icon: PlayIcon, label: labels.watch, step: "01" },
                { icon: MicrophoneIcon, label: labels.shadow, step: "02" },
                { icon: SparklesIcon, label: labels.review, step: "03" },
              ].map(({ icon: Icon, label, step }) => (
                <div
                  key={step}
                  className="flex items-center gap-3 rounded-[14px] border border-white/15 bg-white/[0.06] px-4 py-3"
                >
                  <span className="text-[0.7rem] font-black tracking-[0.12em] text-[#ff6b35]">
                    {step}
                  </span>
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-[0.9rem] font-extrabold">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-page px-gutter pt-8 max-[640px]:px-gutter-mobile">
        {loading ? (
          <div className={stateClasses}>{copy.loading}</div>
        ) : failed ? (
          <div className={stateClasses}>{copy.error}</div>
        ) : lessons.length === 0 ? (
          <div className={stateClasses}>{copy.empty}</div>
        ) : (
          <>
            {featuredLesson ? (
              <section className="mb-10">
                <div className="mb-3 flex items-center gap-2 text-[0.75rem] font-black uppercase tracking-[0.1em] text-[#e0602e]">
                  <SparklesIcon className="h-4 w-4" />
                  {labels.featured}
                </div>
                <Link
                  href={`/shadow/${encodeURIComponent(featuredLesson.id)}`}
                  className="group grid min-h-[360px] grid-cols-[1.15fr_0.85fr] overflow-hidden rounded-[22px] border-2 border-[#050505] bg-white text-[#050505] no-underline shadow-[7px_7px_0_#e0602e] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[9px_10px_0_#e0602e] max-[780px]:grid-cols-1"
                >
                  <div className="relative min-h-[290px] overflow-hidden bg-[#171717] max-[780px]:min-h-[230px]">
                    {featuredLesson.thumbnailUrl ? (
                      <img
                        src={featuredLesson.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,#e0602e_0,transparent_32%),linear-gradient(135deg,#1d1d1d,#050505)]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                    <div className="absolute bottom-5 left-5 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#050505] shadow-lg transition-transform group-hover:scale-110">
                      <PlayIcon className="h-5 w-5 translate-x-[1px]" />
                    </div>
                  </div>

                  <div className="flex flex-col justify-between p-8 max-[640px]:p-6">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#050505] px-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.08em] text-white">
                          {featuredLesson.category}
                        </span>
                        <span className="rounded-full bg-[#f0ede8] px-3 py-1 text-[0.7rem] font-black capitalize text-[#5b554f]">
                          {copy.difficulty[featuredLesson.difficulty]}
                        </span>
                      </div>
                      <h2 className="mt-6 mb-0 text-[clamp(1.75rem,3vw,2.65rem)] font-black leading-[1.04] tracking-[-0.045em]">
                        {featuredLesson.title}
                      </h2>
                      {featuredLesson.description ? (
                        <p className="mt-4 line-clamp-3 text-[0.96rem] font-semibold leading-[1.65] text-black/60">
                          {featuredLesson.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-5 text-[0.9rem] font-black">
                      <span>{labels.start}</span>
                      <ArrowRightIcon className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </section>
            ) : null}

            <section>
              <div className="mb-5 flex items-end justify-between gap-5 max-[760px]:items-stretch max-[760px]:flex-col">
                <div>
                  <h2 className="m-0 text-[1.6rem] font-black tracking-[-0.04em] text-[#050505]">
                    {labels.library}
                  </h2>
                  <p className="mt-1 mb-0 text-[0.82rem] font-bold text-black/45">
                    {filteredLessons.length} {labels.results}
                  </p>
                </div>

                <div className="relative min-w-[250px] max-[760px]:w-full">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={labels.search}
                    className="h-11 w-full rounded-[12px] border-2 border-black/15 bg-white pl-10 pr-4 text-[0.9rem] font-semibold text-[#050505] outline-none transition-colors placeholder:text-black/35 focus:border-[#050505]"
                  />
                </div>
              </div>

              <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filters.map((filter) => {
                  const active = difficulty === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setDifficulty(filter.value)}
                      className={`shrink-0 rounded-full border-2 px-4 py-2 text-[0.78rem] font-black transition-colors ${
                        active
                          ? "border-[#050505] bg-[#050505] text-white"
                          : "border-black/15 bg-white text-black/60 hover:border-black/40 hover:text-black"
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              {filteredLessons.length === 0 ? (
                <div className={stateClasses}>{copy.empty}</div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(245px,1fr))] gap-5">
                  {gridLessons.map((lesson) => (
                    <Link
                      key={lesson.id}
                      href={`/shadow/${encodeURIComponent(lesson.id)}`}
                      className="group overflow-hidden rounded-[18px] border-2 border-[#050505] bg-white text-[#050505] no-underline transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[5px_6px_0_#e0602e] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#e0602e]"
                    >
                      <div className="relative aspect-video overflow-hidden bg-[#171717]">
                        {lesson.thumbnailUrl ? (
                          <img
                            src={lesson.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]"
                          />
                        ) : (
                          <div className="h-full w-full bg-[radial-gradient(circle_at_80%_15%,#e0602e_0,transparent_28%),linear-gradient(135deg,#272727,#080808)]" />
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
                        <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.07em] text-[#050505]">
                          {lesson.category}
                        </span>
                      </div>

                      <div className="p-5">
                        <h3 className="m-0 line-clamp-2 min-h-[2.8em] text-[1.06rem] font-black leading-[1.4] tracking-[-0.025em]">
                          {lesson.title}
                        </h3>
                        {lesson.description ? (
                          <p className="mt-2.5 mb-0 line-clamp-2 min-h-[2.8em] text-[0.82rem] font-semibold leading-[1.5] text-black/50">
                            {lesson.description}
                          </p>
                        ) : null}
                        <div className="mt-5 flex items-center justify-between border-t border-black/10 pt-4">
                          <span className="text-[0.72rem] font-black capitalize text-black/45">
                            {copy.difficulty[lesson.difficulty]}
                          </span>
                          <span className="flex items-center gap-1.5 text-[0.76rem] font-black text-[#e0602e]">
                            {labels.start}
                            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
