"use client";

import type { DeployedExam } from "../types";
import { useI18n } from "../../../i18n/I18nProvider";

type SpeakingCenterLandingProps = {
  tests: DeployedExam[];
  loading: boolean;
  message: string;
  onStartExam: (examSetId: string) => void;
  onStartFirst: () => void;
};

const waveHeights = [24, 42, 30, 58, 74, 36, 50, 68, 34, 46, 70, 38, 56, 28, 44, 64, 34, 52];

const cardTones = [
  "bg-[#050505] text-white",
  "bg-[#fff0e8] text-[#050505]",
  "bg-[#e8eddb] text-[#050505]",
  "bg-[#fdf9ec] text-[#050505]",
  "bg-white text-[#050505]",
  "bg-[#f47a4a] text-[#050505]",
] as const;

function examType(test: DeployedExam) {
  if (test.categories.includes("toefl")) return "TOEFL";
  if (test.categories.includes("topic")) return "OPIC";
  return "FREE";
}

export default function SpeakingCenterLanding({
  tests,
  loading,
  message,
  onStartExam,
  onStartFirst,
}: SpeakingCenterLandingProps) {
  const { t } = useI18n();
  const copy = t.speakingTest.center;
  const visibleTests = tests.slice(0, 12);

  return (
    <main className="w-full bg-[#f5f3ed] text-[#050505] [font-family:Inter,'Noto_Sans_KR',system-ui,sans-serif]">
      <section className="relative overflow-hidden bg-[#f47a4a]">
        <div className="relative mx-auto grid min-h-[592px] w-full max-w-[912px] grid-cols-[526px_346px] gap-10 py-[52px] max-[980px]:grid-cols-1 max-[980px]:gap-9 max-[980px]:px-6 max-[980px]:py-12 max-[640px]:px-5 max-[640px]:py-10">
          <img
            src="/images/speaking-center/hero-accent.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute right-1 top-[410px] h-[92px] w-[92px] max-[980px]:hidden"
          />

          <div className="relative z-10 flex flex-col items-start pt-4 max-[980px]:pt-0">
            <span className="inline-flex h-[30px] items-center rounded-full border-2 border-[#050505] bg-[#f47a4a] px-3 text-[11px] font-bold">
              {copy.eyebrow}
            </span>
            <h1 className="mt-[18px] whitespace-pre-line text-[52px] font-extrabold leading-[56px] tracking-[-0.035em] text-[#050505] max-[640px]:text-[40px] max-[640px]:leading-[44px]">
              {copy.title}
            </h1>
            <p className="mt-[10px] max-w-[526px] text-[18px] font-medium leading-[27px] text-[#050505] max-[640px]:text-[16px] max-[640px]:leading-6">
              {copy.subtitle}
            </p>
            <button
              type="button"
              onClick={onStartFirst}
              disabled={loading}
              className="mt-6 inline-flex min-h-[52px] items-center justify-center rounded-full border-[2.5px] border-[#050505] bg-[#050505] px-7 text-[14px] font-extrabold text-white shadow-[5px_5px_0_#f47a4a] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
            >
              {copy.startFree}
            </button>
          </div>

          <div className="relative z-10 h-[470px] w-[346px] justify-self-end overflow-hidden rounded-[26px] border-[2.5px] border-[#050505] bg-white shadow-[7px_7px_0_rgba(5,5,5,0.14)] max-[980px]:justify-self-start max-[480px]:h-auto max-[480px]:min-h-[470px] max-[480px]:w-full">
            <p className="absolute left-6 top-6 text-[11px] font-extrabold text-[#f47a4a]">{copy.previewLabel}</p>
            <span className="absolute right-6 top-5 inline-flex h-7 min-w-[70px] items-center justify-center rounded-full border-[1.5px] border-[#050505] bg-[#fdf9ec] px-2 text-[11px] font-extrabold">
              00:45
            </span>

            <h2 className="absolute left-6 top-[60px] text-[23px] font-extrabold leading-7 tracking-[-0.03em] text-[#050505]">
              {copy.previewTitle}
            </h2>
            <p className="absolute left-6 right-6 top-[100px] text-[14px] font-medium leading-[22px] text-[#4d4d4d]">
              {copy.previewPrompt}
            </p>

            <div className="absolute left-6 right-6 top-[198px] flex h-[98px] items-center justify-center overflow-hidden rounded-[18px] border border-[#dbdbd6] bg-[#f5f3ed] px-[14px]">
              <div className="flex h-[76px] items-center gap-2">
                {waveHeights.map((height, index) => (
                  <span
                    key={index}
                    className="block w-[7px] shrink-0 rounded-[3px] bg-[#050505]"
                    style={{ height }}
                  />
                ))}
              </div>
            </div>

            <div className="absolute left-1/2 top-[318px] h-[72px] w-[72px] -translate-x-1/2">
              <img src="/images/speaking-center/record-button.svg" alt="" aria-hidden="true" className="h-full w-full" />
              <span className="absolute left-[26px] top-[22px] text-[20px] font-extrabold text-[#050505]">●</span>
            </div>
            <p className="absolute left-1/2 top-[398px] w-[190px] -translate-x-1/2 text-center text-[13px] font-extrabold">
              {copy.recordResponse}
            </p>
            <p className="absolute bottom-[22px] left-1/2 w-[280px] -translate-x-1/2 text-center text-[11px] font-semibold text-[#64748b]">
              {copy.previewMeta}
            </p>
          </div>
        </div>
      </section>

      <section id="practice-exams" className="bg-white">
        <div className="mx-auto w-full max-w-[912px] py-16 max-[980px]:px-6 max-[640px]:px-5 max-[640px]:py-12">
          <span className="inline-flex h-7 items-center rounded-full border-2 border-[#050505] bg-[#f47a4a] px-3 text-[10px] font-extrabold">
            {copy.testsEyebrow}
          </span>
          <h2 className="mt-5 text-[36px] font-extrabold leading-[42px] tracking-[-0.035em] text-[#050505] max-[640px]:text-[30px] max-[640px]:leading-9">
            {copy.testsTitle}
          </h2>
          <p className="mt-2 max-w-[670px] text-[14px] font-medium leading-[21px] text-[#64748b]">
            {copy.testsSubtitle}
          </p>

          {message && (
            <div className="mt-5 rounded-[14px] border border-[#f47a4a] bg-[#fff0e8] px-4 py-3 text-[12px] font-bold text-[#050505]">
              {message}
            </div>
          )}

          {loading && visibleTests.length === 0 ? (
            <div className="mt-10 grid grid-cols-3 gap-6 max-[840px]:grid-cols-2 max-[560px]:grid-cols-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[172px] animate-pulse rounded-[22px] border-2 border-[#050505] bg-[#f5f3ed]" />
              ))}
            </div>
          ) : visibleTests.length === 0 ? (
            <div className="mt-10 rounded-[22px] border-2 border-[#050505] bg-[#fdf9ec] px-6 py-10 text-center">
              <p className="text-[16px] font-extrabold">{copy.noTests}</p>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-3 gap-x-6 gap-y-6 max-[840px]:grid-cols-2 max-[560px]:grid-cols-1">
              {visibleTests.map((test, index) => {
                const dark = index % 6 === 0;
                const tone = cardTones[index % cardTones.length];
                const badge = index === 0 ? copy.free : index === 3 || index === 7 ? copy.popular : null;

                return (
                  <button
                    key={test.id}
                    type="button"
                    onClick={() => onStartExam(test.id)}
                    disabled={loading}
                    className={`group relative h-[172px] w-full overflow-hidden rounded-[22px] border-2 border-[#050505] p-4 text-left shadow-[4px_4px_0_rgba(5,5,5,0.10)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 ${tone}`}
                  >
                    <span className={`inline-flex h-7 min-w-[38px] items-center justify-center rounded-full border-[1.5px] border-[#050505] px-2 text-[10px] font-extrabold ${dark ? "bg-[#f47a4a] text-[#050505]" : "bg-white text-[#050505]"}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {badge && (
                      <span className="absolute right-4 top-4 inline-flex h-7 min-w-[94px] items-center justify-center rounded-full border-[1.5px] border-[#050505] bg-[#fdf9ec] px-3 text-[9px] font-extrabold text-[#050505]">
                        {badge}
                      </span>
                    )}

                    <h3 className={`mt-3 truncate text-[20px] font-extrabold leading-[25px] tracking-[-0.03em] ${dark ? "text-white" : "text-[#050505]"}`}>
                      {test.title}
                    </h3>
                    <div className={`mt-1 text-[11px] font-medium leading-4 ${dark ? "text-[#d1d5db]" : "text-[#64748b]"}`}>
                      <p>{copy.type}: {examType(test)}</p>
                      <p>{copy.difficulty}: {copy.difficultyLow}</p>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                      <span className={`text-[10px] font-semibold ${dark ? "text-[#d1d5db]" : "text-[#64748b]"}`}>
                        {test.taskCount} {copy.tasks} &nbsp;·&nbsp; {copy.minutes}
                      </span>
                      <span className={`text-[11px] font-extrabold ${dark ? "text-[#f47a4a]" : "text-[#050505]"}`}>
                        {copy.start} →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="bg-[#f5f3ed]">
        <div className="mx-auto w-full max-w-[912px] py-[58px] max-[980px]:px-6 max-[640px]:px-5 max-[640px]:py-12">
          <span className="inline-flex h-7 items-center rounded-full border-2 border-[#050505] bg-[#f47a4a] px-3 text-[10px] font-extrabold">
            FAQ
          </span>
          <h2 className="mt-4 text-[36px] font-extrabold leading-[42px] tracking-[-0.035em] text-[#050505] max-[640px]:text-[30px] max-[640px]:leading-9">
            {copy.faqTitle}
          </h2>
          <p className="mt-2 text-[14px] font-medium leading-[21px] text-[#64748b]">{copy.faqSubtitle}</p>

          <div className="mt-10 grid gap-5">
            {copy.faq.map((item) => (
              <article key={item.q} className="relative min-h-[84px] rounded-[18px] border border-[#dbdbd6] bg-white px-[18px] py-[13px] pr-12">
                <h3 className="text-[12px] font-extrabold leading-[18px] text-[#050505]">{item.q}</h3>
                <p className="mt-1 text-[10px] font-medium leading-[15px] text-[#64748b]">{item.a}</p>
                <span aria-hidden="true" className="absolute right-[18px] top-[10px] text-[16px] font-extrabold text-[#f47a4a]">+</span>
              </article>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}
