"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
  MicrophoneIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";

import { useI18n } from "../lib/i18n/I18nProvider";
import { supabase } from "../lib/supabase/client";
import ShadowClient from "./ShadowClient";

type LessonMeta = {
  title: string;
  description: string;
  category: string;
  difficulty: "novice" | "intermediate" | "advanced";
};

const fallbackMeta: LessonMeta = {
  title: "Shadowing Lesson",
  description: "",
  category: "video",
  difficulty: "intermediate",
};

export default function ShadowLessonFrame({ lessonId }: { lessonId: string }) {
  const { locale, t } = useI18n();
  const [lesson, setLesson] = useState<LessonMeta>(fallbackMeta);

  const labels =
    locale === "ko"
      ? {
          back: "쉐도잉 라이브러리",
          eyebrow: "영상 쉐도잉",
          flow: ["영상 이해", "따라 말하기", "표현 내재화", "결과 확인"],
          helper:
            "원문을 이해한 뒤 문장별로 반복하고, 발음 피드백을 확인하며 표현을 내 것으로 만드세요.",
        }
      : {
          back: "Shadowing library",
          eyebrow: "Video shadowing",
          flow: ["Understand", "Shadow", "Internalize", "Review"],
          helper:
            "Understand the line, repeat it precisely, then turn the expression into speech you can use naturally.",
        };

  useEffect(() => {
    let alive = true;

    const loadMeta = async () => {
      const { data, error } = await supabase
        .from("shadow")
        .select("title,description,category,difficulty")
        .eq("id", lessonId)
        .maybeSingle();

      if (!alive || error || !data) return;

      const difficulty =
        data.difficulty === "novice" || data.difficulty === "advanced"
          ? data.difficulty
          : "intermediate";

      setLesson({
        title:
          typeof data.title === "string" && data.title.trim()
            ? data.title
            : fallbackMeta.title,
        description:
          typeof data.description === "string" ? data.description : "",
        category:
          typeof data.category === "string" && data.category.trim()
            ? data.category
            : fallbackMeta.category,
        difficulty,
      });
    };

    void loadMeta();
    return () => {
      alive = false;
    };
  }, [lessonId]);

  const flow = [
    { icon: PlayIcon, label: labels.flow[0], step: "01" },
    { icon: MicrophoneIcon, label: labels.flow[1], step: "02" },
    {
      icon: ChatBubbleBottomCenterTextIcon,
      label: labels.flow[2],
      step: "03",
    },
    { icon: ChartBarIcon, label: labels.flow[3], step: "04" },
  ];

  return (
    <main className="min-h-screen bg-[#f7f6f2]">
      <header className="border-b-2 border-[#050505] bg-white">
        <div className="mx-auto w-full max-w-page px-gutter py-7 max-[640px]:px-gutter-mobile max-[640px]:py-5">
          <Link
            href="/shadow"
            className="inline-flex items-center gap-2 text-[0.78rem] font-black text-black/55 no-underline transition-colors hover:text-[#050505]"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {labels.back}
          </Link>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#050505] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.09em] text-white">
              {lesson.category}
            </span>
            <span className="rounded-full bg-[#f0ede8] px-3 py-1 text-[0.68rem] font-black capitalize text-black/55">
              {t.shadow.library.difficulty[lesson.difficulty]}
            </span>
            <span className="text-[0.7rem] font-black uppercase tracking-[0.11em] text-[#e0602e]">
              {labels.eyebrow}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] gap-10 max-[860px]:grid-cols-1 max-[860px]:gap-7">
            <div>
              <h1 className="m-0 max-w-[760px] text-[clamp(2rem,4.8vw,3.7rem)] font-black leading-[1.02] tracking-[-0.055em] text-[#050505]">
                {lesson.title}
              </h1>
              <p className="mt-4 mb-0 max-w-[680px] text-[0.95rem] font-semibold leading-[1.7] text-black/55">
                {lesson.description || labels.helper}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-[480px]:grid-cols-1">
              {flow.map(({ icon: Icon, label, step }) => (
                <div
                  key={step}
                  className="flex min-h-[72px] items-center gap-3 rounded-[14px] border-2 border-black/10 bg-[#faf9f6] px-4 py-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#050505] text-white">
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <div className="text-[0.62rem] font-black tracking-[0.11em] text-[#e0602e]">
                      {step}
                    </div>
                    <div className="mt-0.5 text-[0.78rem] font-black text-[#050505]">
                      {label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <ShadowClient lessonId={lessonId} />
    </main>
  );
}
