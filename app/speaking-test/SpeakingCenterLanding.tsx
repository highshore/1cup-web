"use client";

import type { CSSProperties } from "react";

import type {
  DeployedExam,
  SpeakingTestAttempt,
} from "../lib/features/speaking-test/types";
import { useI18n } from "../lib/i18n/I18nProvider";

const TEST_COLORS = [
  { background: "#050505", foreground: "#ffffff", muted: "#d1d5db", accent: "#f47a4a" },
  { background: "#fff0e8", foreground: "#050505", muted: "#64748b", accent: "#050505" },
  { background: "#e8eddb", foreground: "#050505", muted: "#64748b", accent: "#050505" },
  { background: "#fdf9ec", foreground: "#050505", muted: "#64748b", accent: "#050505" },
  { background: "#ffffff", foreground: "#050505", muted: "#64748b", accent: "#050505" },
  { background: "#f47a4a", foreground: "#050505", muted: "#4d4d4d", accent: "#050505" },
] as const;

const WAVE_BARS = [24, 42, 30, 58, 74, 36, 50, 68, 34, 46, 70, 38, 56, 28, 44, 64, 34, 52];

function testType(test: DeployedExam, locale: "en" | "ko") {
  if (test.categories.includes("toefl")) return "TOEFL";
  if (test.categories.includes("topic")) return "OPIc";
  if (test.categories.includes("free")) return locale === "ko" ? "자유 연습" : "Free style";
  return locale === "ko" ? "스피킹" : "Speaking";
}

function testBadge(test: DeployedExam, locale: "en" | "ko") {
  if (test.categories.includes("free")) return locale === "ko" ? "자유 연습" : "FREE STYLE";
  return null;
}

function formatDate(value: string | null, locale: "en" | "ko") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export default function SpeakingCenterLanding({
  tests,
  attempts,
  busy,
  message,
  onStartTest,
  onOpenReport,
}: {
  tests: DeployedExam[];
  attempts: SpeakingTestAttempt[];
  busy: boolean;
  message: string;
  onStartTest: (examSetId: string) => void;
  onOpenReport: (attempt: SpeakingTestAttempt) => void;
}) {
  const { locale, t } = useI18n();
  const copy = t.speakingCenter;
  const visibleTests = tests.slice(0, 12);
  const completedAttempts = attempts.filter((entry) => entry.report);

  const scrollToTests = () => {
    document.getElementById("speaking-practice-tests")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="w-full bg-[#f5f3ed] font-sans text-[#050505]">
      <section className="bg-[#f47a4a]">
        <div className="mx-auto grid min-h-[592px] max-w-[912px] grid-cols-[minmax(0,1fr)_346px] items-start gap-10 px-0 py-[52px] max-[980px]:grid-cols-1 max-[980px]:px-6 max-[980px]:py-12 max-[640px]:px-4">
          <div className="pt-4 max-[980px]:pt-0">
            <span className="inline-flex min-h-[30px] items-center justify-center rounded-full border-2 border-[#050505] px-4 text-[11px] font-extrabold uppercase tracking-[0.02em]">
              {copy.eyebrow}
            </span>

            <h1 className="mt-4 max-w-[560px] text-[52px] font-extrabold leading-[56px] tracking-[-0.055em] text-[#050505] max-[640px]:text-[42px] max-[640px]:leading-[46px]">
              <span className="block">{copy.titleLineOne}</span>
              <span className="block">{copy.titleLineTwo}</span>
            </h1>

            <p className="mt-4 max-w-[526px] text-[18px] font-medium leading-[27px] text-[#050505] max-[640px]:text-[16px] max-[640px]:leading-6">
              {copy.subtitle}
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={scrollToTests}
              className="mt-7 inline-flex min-h-[52px] items-center justify-center rounded-full border-[2.5px] border-[#050505] bg-[#050505] px-7 text-[14px] font-extrabold text-white shadow-[5px_5px_0_0_#fff0e8] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
            >
              {copy.startFree}
            </button>

            {message && (
              <p className="mt-5 max-w-[560px] rounded-2xl border-2 border-[#050505] bg-[#fff0e8] px-4 py-3 text-[13px] font-bold leading-5 text-[#8d2d1d]">
                {message}
              </p>
            )}
          </div>

          <div className="relative mx-auto h-[470px] w-full max-w-[346px] overflow-hidden rounded-[26px] border-[2.5px] border-[#050505] bg-white shadow-[7px_7px_0_0_rgba(5,5,5,0.14)]">
            <div className="absolute left-6 top-6 text-[11px] font-extrabold text-[#f47a4a]">
              {copy.previewEyebrow}
            </div>
            <div className="absolute right-6 top-5 flex h-7 w-[70px] items-center justify-center rounded-full border-[1.5px] border-[#050505] bg-[#fdf9ec] text-[11px] font-extrabold">
              00:45
            </div>
            <h2 className="absolute left-6 top-[62px] m-0 text-[23px] font-extrabold tracking-[-0.035em] text-[#050505]">
              {copy.previewTitle}
            </h2>
            <p className="absolute left-6 right-6 top-[102px] m-0 text-[14px] font-medium leading-[22px] text-[#4d4d4d]">
              {copy.previewPrompt}
            </p>

            <div className="absolute left-6 right-6 top-[198px] flex h-[98px] items-center justify-center gap-2 overflow-hidden rounded-[18px] border border-[#dbdbd6] bg-[#f5f3ed] px-3">
              {WAVE_BARS.map((height, index) => (
                <span
                  key={index}
                  className="block w-[7px] shrink-0 rounded-[3px] bg-[#050505]"
                  style={{ height } as CSSProperties}
                />
              ))}
            </div>

            <div className="absolute left-1/2 top-[318px] flex h-[68px] w-[68px] -translate-x-1/2 items-center justify-center rounded-full border-[2.5px] border-[#050505] bg-[#f47a4a] shadow-[4px_4px_0_0_#050505]">
              <span className="h-5 w-5 rounded-full bg-[#050505]" aria-hidden="true" />
            </div>
            <div className="absolute left-0 right-0 top-[398px] text-center text-[13px] font-extrabold">
              {copy.previewRecord}
            </div>
            <div className="absolute left-0 right-0 top-[432px] text-center text-[11px] font-semibold text-[#64748b]">
              {copy.previewMeta}
            </div>
          </div>
        </div>
      </section>

      <section id="speaking-practice-tests" className="scroll-mt-24 bg-white">
        <div className="mx-auto max-w-[912px] px-0 py-16 max-[980px]:px-6 max-[640px]:px-4">
          <span className="inline-flex min-h-7 items-center justify-center rounded-full border-2 border-[#050505] bg-[#f47a4a] px-4 text-[10px] font-extrabold uppercase">
            {copy.testsEyebrow}
          </span>
          <h2 className="mt-4 text-[36px] font-extrabold leading-[42px] tracking-[-0.045em] text-[#050505] max-[640px]:text-[30px] max-[640px]:leading-9">
            {copy.testsTitle}
          </h2>
          <p className="mt-2 max-w-[670px] text-[14px] font-medium leading-[21px] text-[#64748b]">
            {copy.testsIntro}
          </p>

          {message && (
            <p className="mt-5 rounded-2xl border-2 border-[#050505] bg-[#fff0e8] px-4 py-3 text-[13px] font-bold leading-5 text-[#8d2d1d]">
              {message}
            </p>
          )}

          {busy && tests.length === 0 ? (
            <div className="mt-10 rounded-[22px] border-2 border-[#050505] bg-[#fdf9ec] p-6 text-sm font-bold">
              {copy.loading}
            </div>
          ) : visibleTests.length === 0 ? (
            <div className="mt-10 rounded-[22px] border-2 border-[#050505] bg-[#fdf9ec] p-6 text-sm font-bold">
              {copy.noTests}
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-3 gap-x-6 gap-y-6 max-[840px]:grid-cols-2 max-[560px]:grid-cols-1">
              {visibleTests.map((test, index) => {
                const palette = TEST_COLORS[index % TEST_COLORS.length];
                const badge = testBadge(test, locale);
                return (
                  <button
                    key={test.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onStartTest(test.id)}
                    className="relative min-h-[172px] overflow-hidden rounded-[22px] border-2 border-[#050505] p-4 text-left shadow-[4px_4px_0_0_rgba(5,5,5,0.1)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
                    style={{
                      backgroundColor: palette.background,
                      color: palette.foreground,
                    }}
                  >
                    <span
                      className="inline-flex h-7 min-w-[38px] items-center justify-center rounded-full border-[1.5px] border-[#050505] bg-white px-2 text-[10px] font-extrabold text-[#050505]"
                      style={index % TEST_COLORS.length === 0 ? { backgroundColor: "#f47a4a" } : undefined}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    {badge && (
                      <span className="absolute right-4 top-4 inline-flex h-7 items-center justify-center rounded-full border-[1.5px] border-[#050505] bg-[#fdf9ec] px-3 text-[9px] font-extrabold text-[#050505]">
                        {badge}
                      </span>
                    )}

                    <strong className="mt-3 block truncate text-[20px] font-extrabold tracking-[-0.035em]">
                      {test.title}
                    </strong>
                    <span
                      className="mt-1.5 block text-[11px] font-medium leading-4"
                      style={{ color: palette.muted }}
                    >
                      {copy.type}: {testType(test, locale)}
                      <br />
                      {copy.difficulty}: {copy.difficultyValue}
                    </span>

                    <span
                      className="absolute bottom-4 left-4 text-[10px] font-semibold"
                      style={{ color: palette.muted }}
                    >
                      {test.taskCount} {copy.tasks}
                    </span>
                    <span
                      className="absolute bottom-4 right-4 text-[11px] font-extrabold"
                      style={{ color: palette.accent }}
                    >
                      {copy.start}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {completedAttempts.length > 0 && (
            <div className="mt-12 border-t border-[#dbdbd6] pt-8">
              <h3 className="text-[20px] font-extrabold tracking-[-0.035em] text-[#050505]">
                {copy.savedTitle}
              </h3>
              <div className="mt-4 grid gap-3">
                {completedAttempts.slice(0, 4).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onOpenReport(entry)}
                    className="flex w-full items-center justify-between gap-4 rounded-[18px] border border-[#dbdbd6] bg-[#f5f3ed] px-4 py-3 text-left text-[#050505] hover:border-[#050505]"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-[13px] font-extrabold">
                        {entry.examTitle}
                      </strong>
                      <span className="mt-1 block text-[11px] text-[#64748b]">
                        {formatDate(entry.completedAt, locale)}
                      </span>
                    </span>
                    <strong className="shrink-0 text-[12px]">
                      {entry.score ?? "—"}/55 · {entry.band ?? "—"}
                    </strong>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-[#f5f3ed]">
        <div className="mx-auto max-w-[912px] px-0 py-14 max-[980px]:px-6 max-[640px]:px-4">
          <span className="inline-flex min-h-7 items-center justify-center rounded-full border-2 border-[#050505] bg-[#f47a4a] px-4 text-[10px] font-extrabold uppercase">
            {copy.faqEyebrow}
          </span>
          <h2 className="mt-4 text-[36px] font-extrabold leading-[42px] tracking-[-0.045em] text-[#050505] max-[640px]:text-[30px] max-[640px]:leading-9">
            {copy.faqTitle}
          </h2>
          <p className="mt-2 text-[14px] font-medium leading-[21px] text-[#64748b]">
            {copy.faqIntro}
          </p>

          <div className="mt-10 grid gap-5">
            {copy.faq.map((item) => (
              <div
                key={item.q}
                className="relative min-h-[84px] rounded-[18px] border border-[#dbdbd6] bg-white px-[18px] py-[14px] pr-14"
              >
                <h3 className="m-0 text-[12px] font-extrabold leading-[18px] text-[#050505]">
                  {item.q}
                </h3>
                <p className="mt-1 text-[11px] font-medium leading-[17px] text-[#64748b]">
                  {item.a}
                </p>
                <span
                  aria-hidden="true"
                  className="absolute right-[18px] top-[10px] text-[20px] font-extrabold leading-none text-[#f47a4a]"
                >
                  +
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
