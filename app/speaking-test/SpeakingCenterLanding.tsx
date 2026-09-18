"use client";

import { useState, type CSSProperties } from "react";

import type { DeployedExam } from "../lib/features/speaking-test/types";
import { useI18n } from "../lib/i18n/I18nProvider";

const pageContainerClass =
  "mx-auto w-full max-w-page px-gutter max-[920px]:px-gutter-mobile";

const TEST_COLORS = [
  "#050505",
  "#fff0e8",
  "#e8eddb",
  "#fdf9ec",
  "#ffffff",
  "#f47a4a",
  "#050505",
  "#fff0e8",
  "#e8eddb",
  "#fdf9ec",
  "#ffffff",
  "#f47a4a",
] as const;

const WAVE_BARS = [24, 42, 30, 58, 74, 36, 50, 68, 34, 46, 70, 38, 56, 28, 44, 64, 34, 52];

function testType(test: DeployedExam | undefined, locale: "en" | "ko") {
  if (!test) return "TOEFL";
  if (test.categories.includes("toefl")) return "TOEFL";
  if (test.categories.includes("topic")) return "OPIc";
  if (test.categories.includes("free")) return locale === "ko" ? "자유 연습" : "Free style";
  return locale === "ko" ? "스피킹" : "Speaking";
}

export default function SpeakingCenterLanding({
  tests,
  busy,
  message,
  onStartTest,
}: {
  tests: DeployedExam[];
  busy: boolean;
  message: string;
  onStartTest: (examSetId: string) => void;
}) {
  const { locale, t } = useI18n();
  const copy = t.speakingCenter;
  const isKo = locale === "ko";
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const liveTests = tests.slice(0, 12);
  const displayCards = Array.from({ length: 12 }, (_, index) => {
    const test = liveTests[index];
    return {
      test,
      title:
        test?.title ??
        (isKo ? `스피킹 테스트 ${index + 1}` : `Speaking Test ${index + 1}`),
      taskCount: test?.taskCount ?? 4,
      type: testType(test, locale),
      badge:
        index === 0
          ? copy.free
          : index === 3 || index === 7
            ? copy.popular
            : null,
    };
  });

  const handleHeroStart = () => {
    const freeTest = liveTests.find((test) => test.categories.includes("free"));
    const firstTest = freeTest ?? liveTests[0];
    if (firstTest) {
      onStartTest(firstTest.id);
      return;
    }
    document.getElementById("exam-practice-tests")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const fontClass = isKo
    ? "[font-family:'Noto_Sans_KR',sans-serif]"
    : "[font-family:Inter,Arial,sans-serif]";

  return (
    <main className={`w-full bg-[#f5f3ed] text-[#050505] ${fontClass}`}>
      <section className="bg-[#f47a4a]">
        <div className={pageContainerClass}>
          <div className="relative h-[592px] max-[860px]:h-auto max-[860px]:py-10">
            <div
              className={`absolute left-0 w-[560px] max-w-[58%] max-[860px]:relative max-[860px]:top-auto max-[860px]:w-full max-[860px]:max-w-none ${
                isKo ? "top-[110px]" : "top-[105px]"
              }`}
            >
              <span
                className={`inline-flex h-[30px] w-[154px] items-center justify-center rounded-[15px] border-2 border-[#050505] bg-[#f47a4a] text-[11px] leading-none text-[#050505] ${
                  isKo ? "font-bold" : "font-[800]"
                }`}
              >
                {copy.eyebrow}
              </span>

              <h1
                className={`mt-[18px] h-[124px] w-[560px] max-w-full text-[52px] leading-[56px] tracking-[-0.045em] text-[#050505] max-[640px]:h-auto max-[640px]:text-[40px] max-[640px]:leading-[45px] ${
                  isKo ? "font-bold" : "font-[800]"
                }`}
              >
                <span className="block">{copy.titleLineOne}</span>
                <span className="block">{copy.titleLineTwo}</span>
              </h1>

              <p
                className={`h-[74px] w-[526px] max-w-full text-[18px] leading-[27px] text-[#050505] max-[640px]:h-auto max-[640px]:text-[16px] max-[640px]:leading-6 ${
                  isKo ? "mt-[18px] font-medium" : "mt-[10px] font-medium"
                }`}
              >
                {copy.subtitle}
              </p>

              <button
                type="button"
                disabled={busy}
                onClick={handleHeroStart}
                className={`inline-flex h-[52px] items-center justify-center rounded-[26px] border-[2.5px] border-[#050505] bg-[#050505] px-5 text-[14px] text-white shadow-[5px_5px_0_0_#f47a4a] transition-transform hover:-translate-y-px disabled:cursor-wait disabled:opacity-60 ${
                  isKo
                    ? "mt-[24px] w-[185px] font-bold"
                    : "mt-[32px] w-[203px] font-[800]"
                }`}
              >
                {copy.startFree}
              </button>
            </div>

            <div className="absolute right-0 top-[52px] h-[470px] w-[346px] max-[860px]:relative max-[860px]:top-auto max-[860px]:right-auto max-[860px]:mx-auto max-[860px]:mt-10 max-[420px]:w-full">
              <span className="absolute -right-[-4px] bottom-[20px] h-[92px] w-[92px] rounded-full bg-[#e8eddb]" aria-hidden="true" />

              <div className="relative h-full w-full overflow-hidden rounded-[26px] border-[2.5px] border-[#050505] bg-white shadow-[7px_7px_0_0_rgba(5,5,5,0.14)]">
                <p
                  className={`absolute left-[21.5px] top-[21.5px] h-4 w-[150px] text-[11px] leading-normal text-[#f47a4a] ${
                    isKo ? "font-bold" : "font-[800]"
                  }`}
                >
                  {copy.previewEyebrow}
                </p>

                <div className="absolute left-[249.5px] top-[17.5px] flex h-7 w-[70px] items-center justify-center rounded-[14px] border-[1.5px] border-[#050505] bg-[#fdf9ec] text-[11px] font-[800] text-[#050505]">
                  00:45
                </div>

                <h2
                  className={`absolute left-[21.5px] top-[59.5px] m-0 h-7 w-[260px] text-[23px] leading-normal tracking-[-0.02em] text-[#050505] ${
                    isKo ? "font-bold" : "font-[800]"
                  }`}
                >
                  {copy.previewTitle}
                </h2>

                <p
                  className={`absolute left-[21.5px] top-[99.5px] h-[74px] w-[298px] text-[14px] leading-[22px] text-[#4d4d4d] ${
                    isKo ? "font-medium" : "font-medium"
                  }`}
                >
                  {copy.previewPrompt}
                </p>

                <div className="absolute left-[21.5px] top-[195.5px] flex h-[98px] w-[298px] items-center justify-center gap-2 overflow-hidden rounded-[18px] border border-[#dbdbd6] bg-[#f5f3ed] px-3">
                  {WAVE_BARS.map((height, index) => (
                    <span
                      key={index}
                      className="block w-[7px] shrink-0 rounded-[3px] bg-[#050505]"
                      style={{ height } as CSSProperties}
                    />
                  ))}
                </div>

                <div className="absolute left-[136.5px] top-[315.5px] flex h-[68px] w-[68px] items-center justify-center rounded-full border-[2.5px] border-[#050505] bg-[#f47a4a] shadow-[4px_4px_0_0_#050505]">
                  <span className="h-5 w-5 rounded-full bg-[#050505]" />
                </div>

                <p className="absolute left-[159px] top-[335.5px] m-0 h-7 w-7 text-center text-[20px] font-[800] leading-7 text-[#050505]">
                  ●
                </p>

                <p
                  className={`absolute left-[88px] top-[395.5px] h-[18px] w-[170px] text-center text-[13px] leading-normal text-[#050505] ${
                    isKo ? "font-bold" : "font-[800]"
                  }`}
                >
                  {copy.previewRecord}
                </p>

                <p
                  className={`absolute left-[44px] top-[429.5px] h-4 w-[258px] text-center text-[11px] leading-normal text-[#64748b] ${
                    isKo ? "font-medium" : "font-semibold"
                  }`}
                >
                  {copy.previewMeta}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="exam-practice-tests" className="bg-white">
        <div className={pageContainerClass}>
          <div className="relative h-[1120px] max-[760px]:h-auto max-[760px]:py-12">
            <span
              className={`absolute left-0 top-16 inline-flex h-7 w-[132px] items-center justify-center rounded-[14px] border-2 border-[#050505] bg-[#f47a4a] text-[10px] leading-none text-[#050505] max-[760px]:static ${
                isKo ? "font-bold" : "font-[800]"
              }`}
            >
              {copy.testsEyebrow}
            </span>

            <h2
              className={`absolute left-0 top-28 h-[46px] w-[600px] max-w-full text-[36px] leading-[42px] tracking-[-0.03em] text-[#050505] max-[760px]:static max-[760px]:mt-5 max-[640px]:h-auto max-[640px]:text-[30px] max-[640px]:leading-9 ${
                isKo ? "font-bold" : "font-[800]"
              }`}
            >
              {copy.testsTitle}
            </h2>

            <p
              className={`absolute left-0 top-[166px] h-11 w-[670px] max-w-full text-[14px] leading-[21px] text-[#64748b] max-[760px]:static max-[760px]:mt-2 max-[760px]:h-auto ${
                isKo ? "font-medium" : "font-medium"
              }`}
            >
              {copy.testsIntro}
            </p>

            {message && (
              <p className="absolute left-0 top-[212px] z-10 m-0 rounded-lg bg-[#fff0e8] px-3 py-2 text-[11px] font-semibold text-[#8d2d1d] max-[760px]:static max-[760px]:mt-4">
                {message}
              </p>
            )}

            <div className="absolute left-0 top-[250px] grid w-full grid-cols-3 gap-x-6 gap-y-6 max-[760px]:static max-[760px]:mt-10 max-[760px]:grid-cols-2 max-[520px]:grid-cols-1">
              {displayCards.map((card, index) => {
                const background = TEST_COLORS[index];
                const dark = background === "#050505";
                const foreground = dark ? "#ffffff" : "#050505";
                const metaColor = dark ? "#d1d5db" : "#64748b";
                const accent = dark ? "#f47a4a" : "#050505";
                const numberFill = dark ? "#f47a4a" : "#ffffff";
                const badgeFill = index === 0 ? "#f47a4a" : "#fdf9ec";
                const isLive = Boolean(card.test);

                return (
                  <button
                    key={index}
                    type="button"
                    aria-disabled={!isLive}
                    onClick={() => {
                      if (card.test) onStartTest(card.test.id);
                    }}
                    className={`relative h-[172px] w-full overflow-hidden rounded-[22px] border-2 border-[#050505] p-0 text-left shadow-[4px_4px_0_0_rgba(5,5,5,0.10)] ${
                      isLive ? "cursor-pointer transition-transform hover:-translate-y-px" : "cursor-default"
                    }`}
                    style={{ backgroundColor: background, color: foreground }}
                  >
                    <span
                      className="absolute left-[14px] top-[14px] inline-flex h-7 w-[38px] items-center justify-center rounded-[14px] border-[1.5px] border-[#050505] text-[10px] font-[800] text-[#050505]"
                      style={{ backgroundColor: numberFill }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    {card.badge && (
                      <span
                        className={`absolute left-[174px] top-[14px] inline-flex h-7 w-[94px] items-center justify-center rounded-[14px] border-[1.5px] border-[#050505] text-[9px] text-[#050505] ${
                          isKo ? "font-bold" : "font-[800]"
                        }`}
                        style={{ backgroundColor: badgeFill }}
                      >
                        {card.badge}
                      </span>
                    )}

                    <strong
                      className={`absolute left-[14px] top-14 h-[25px] w-[240px] truncate text-[20px] leading-normal ${
                        isKo ? "font-bold" : "font-[800]"
                      }`}
                    >
                      {card.title}
                    </strong>

                    <span className="absolute left-[14px] top-[88px] h-8 w-[250px] text-[11px] font-medium leading-4 text-[#d1d5db]">
                      {copy.type}: {card.type}
                      <br />
                      {copy.difficulty}: {copy.difficultyValue}
                    </span>

                    <span
                      className={`absolute left-[14px] top-[136px] h-4 w-[160px] text-[10px] leading-normal ${
                        isKo ? "font-medium" : "font-semibold"
                      }`}
                      style={{ color: metaColor }}
                    >
                      {card.taskCount} {copy.tasks}   ·   {copy.duration}
                    </span>

                    <span
                      className={`absolute right-[20px] top-[134px] h-[18px] w-[58px] text-right text-[11px] leading-normal ${
                        isKo ? "font-bold" : "font-[800]"
                      }`}
                      style={{ color: accent }}
                    >
                      {copy.start}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f5f5f5]">
        <div className={pageContainerClass}>
          <div className="py-[78px] pb-[81px]">
            <h2
              className={`m-0 h-12 text-[38.4px] leading-[46px] tracking-[-0.768px] text-[#0f172a] max-[640px]:h-auto max-[640px]:text-[32px] max-[640px]:leading-10 ${
                isKo ? "font-bold" : "font-[800]"
              }`}
            >
              {copy.faqTitle}
            </h2>

            <div className="mt-6 flex flex-col gap-[19px]">
              {copy.faq.map((item, index) => {
                const isOpen = openFAQ === index;
                return (
                  <div
                    key={item.q}
                    className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white transition-[border-color,box-shadow] duration-200 hover:border-[#050505] hover:shadow-[4px_4px_0_rgba(5,5,5,0.9)]"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFAQ(isOpen ? null : index)}
                      className={`flex h-[68px] w-full items-center justify-between bg-transparent px-6 text-left text-[16.8px] leading-[22px] tracking-[-0.168px] text-[#1f2937] ${
                        isKo ? "font-bold" : "font-semibold"
                      }`}
                    >
                      {item.q}
                      <span className="ml-4 inline-flex h-7 w-[26px] shrink-0 items-center justify-center text-[22.4px] font-semibold leading-7 text-[#2c1810]">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>

                    <div
                      className={`overflow-hidden px-6 text-[0.95rem] leading-[1.7] text-[#6b7280] transition-[max-height,padding] duration-300 ${
                        isOpen ? "max-h-[260px] pb-6" : "max-h-0 pb-0"
                      }`}
                    >
                      {item.a}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <footer className="h-[356px] bg-[#050505] max-[760px]:h-auto">
        <div className={pageContainerClass}>
          <div className="relative h-[356px] max-[760px]:h-auto max-[760px]:py-12">
            <div className="absolute left-0 top-[72px] max-[760px]:static">
              <p className="m-0 h-6 w-[180px] text-[18px] font-[800] leading-normal text-white">
                1 CUP ENGLISH
              </p>
              <p
                className={`mt-3 h-[46px] w-[360px] max-w-full text-[13px] leading-5 text-[#d1d5db] ${
                  isKo ? "font-medium" : "font-medium"
                }`}
              >
                {copy.footer.tagline}
              </p>
            </div>

            <div className="absolute left-[448px] top-[72px] grid grid-cols-3 gap-[26px] max-[760px]:static max-[760px]:mt-8 max-[760px]:grid-cols-2 max-[520px]:grid-cols-1">
              {[copy.footer.practice, copy.footer.community, copy.footer.account].map((column, columnIndex) => (
                <div
                  key={columnIndex}
                  className={`h-[110px] w-[150px] text-[11px] leading-[26px] text-[#d1d5db] ${
                    isKo ? "font-medium" : "font-semibold"
                  }`}
                >
                  {column.map((item, itemIndex) => (
                    <p key={item} className="m-0">
                      {item}
                    </p>
                  ))}
                </div>
              ))}
            </div>

            <div className="absolute left-0 top-[238px] h-px w-full bg-[#2a2a2a] max-[760px]:static max-[760px]:mt-8" />

            <p
              className={`absolute left-0 top-[270px] m-0 h-[18px] w-[480px] max-w-full text-[10px] leading-normal text-[#8b8b8b] max-[760px]:static max-[760px]:mt-6 ${
                isKo ? "font-medium" : "font-medium"
              }`}
            >
              {copy.footer.copyright}
            </p>

            <p
              className={`absolute right-0 top-[270px] m-0 h-[18px] w-[312px] text-right text-[10px] leading-normal whitespace-pre-wrap text-[#8b8b8b] max-[760px]:static max-[760px]:mt-3 max-[760px]:w-full max-[760px]:text-left ${
                isKo ? "font-medium" : "font-medium"
              }`}
            >
              {copy.footer.links}
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
