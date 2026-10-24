"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { HomeTopicArticle, fetchHomeTopicsClient } from "../services/topics_service_client";
import { useI18n } from "../../../i18n/I18nProvider";
import "./home.css";

interface TopicsShowcaseProps {
  topics: HomeTopicArticle[];
}

export default function TopicsShowcase({ topics: initialTopics }: TopicsShowcaseProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [topics, setTopics] = useState<HomeTopicArticle[]>(initialTopics || []);
  const [loading, setLoading] = useState(!initialTopics || initialTopics.length === 0);

  const displayTopics = useMemo(
    () => (topics.length > 0 ? [...topics, ...topics] : []),
    [topics]
  );

  useEffect(() => {
    // Always fetch from the browser Supabase client if no initial topics
    if (!initialTopics || initialTopics.length === 0) {
      console.log('Fetching topics from client-side Supabase...');
      fetchHomeTopicsClient()
        .then(data => {
          console.log('Topics fetched:', data);
          if (data && Array.isArray(data)) {
            setTopics(data);
          }
        })
        .catch(error => {
          console.error('Error fetching topics:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [initialTopics]);

  const isAutoScrollEnabled = displayTopics.length > 0;
  const autoDuration = Math.max(displayTopics.length * 3, 18);

  // Always render the section
  return (
    <section className="relative w-screen ml-[calc(50%-50vw)] overflow-hidden bg-[#f47a4a] pt-[clamp(3.5rem,7vw,5rem)] pb-[clamp(4rem,8vw,6rem)] text-[#050505]">
      <div className="mx-auto mb-[clamp(2rem,4vw,3rem)] max-w-page px-[clamp(1.25rem,4vw,1.5rem)] text-left max-[768px]:px-4 max-[768px]:text-center">
        <h2 className="mb-6 font-['Noto_Sans_KR',sans-serif] text-[clamp(1.85rem,3vw,2.4rem)] font-black leading-[1.2] text-[#050505] max-[768px]:text-center">
          {t.home.topicsShowcase.titlePrefix}
          <span className="text-[#050505]">{t.home.topicsShowcase.titleHighlight}</span>
          {t.home.topicsShowcase.titleSuffix}
        </h2>
      </div>

      {loading ? (
        <div className="p-8 text-center text-[1rem] text-[#050505]">{t.common.loading}</div>
      ) : topics.length > 0 ? (
        <div className="relative w-screen ml-[calc(50%-50vw)] pb-8">
          <div className="w-full overflow-visible">
            {isAutoScrollEnabled ? (
              <div className="relative w-full overflow-hidden [contain:layout_paint_style] [transform:translateZ(0)] [&:hover>div]:[animation-play-state:paused]">
                <div
                  className="flex min-w-max gap-[clamp(0.85rem,3vw,1.5rem)] backface-hidden will-change-transform [transform:translate3d(0,0,0)] animate-[home-auto-scroll_1s_linear_infinite] [animation-play-state:running] motion-reduce:animate-none motion-reduce:overflow-x-auto motion-reduce:snap-x motion-reduce:snap-mandatory"
                  style={{ animationDuration: `${autoDuration}s` }}
                >
                  {displayTopics.map((topic, idx) => (
                    <div
                      key={`${topic.id}-${idx}`}
                      onClick={() => router.push(`/article/${topic.id}`)}
                      aria-hidden={idx >= topics.length}
                      className="group relative isolate aspect-square flex-[0_0_clamp(240px,26vw,320px)] cursor-pointer snap-start overflow-hidden rounded-[10px] border-2 border-[#050505] bg-[#fff8dc] shadow-[4px_4px_0_rgba(5,5,5,0.88)] backface-hidden [contain:paint] [transform:translateZ(0)] transition-transform duration-[220ms] ease-[ease] hover:[transform:perspective(900px)_rotateY(-3deg)_translateY(-2px)] hover:shadow-[5px_5px_0_rgba(5,5,5,0.88)] after:content-[''] after:pointer-events-none after:absolute after:inset-0 after:z-[3] after:bg-[linear-gradient(180deg,rgba(5,5,5,0)_22%,rgba(5,5,5,0.82)_100%)] after:opacity-90 after:transition-opacity after:duration-200 after:ease-[ease] max-[640px]:basis-[min(78vw,300px)] max-[640px]:shadow-[3px_3px_0_rgba(5,5,5,0.88)]"
                    >
                      {topic.imageUrl ? (
                        <img
                          className="absolute inset-0 z-0 h-full w-full object-cover backface-hidden [transform:translateZ(0)]"
                          src={topic.imageUrl}
                          alt={topic.titleEnglish || topic.titleKorean}
                          width={320}
                          height={320}
                          loading={idx < 3 ? "eager" : "lazy"}
                          fetchPriority={idx < 2 ? "high" : "auto"}
                          decoding="async"
                          draggable={false}
                          onContextMenu={(event) => event.preventDefault()}
                        />
                      ) : (
                        <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#fff8dc] text-[3rem]">📰</div>
                      )}
                      <div className="relative z-[4] flex h-full flex-col justify-end p-[clamp(1rem,2.5vw,1.3rem)] max-[640px]:p-4">
                        <h3 className="m-0 line-clamp-2 text-[clamp(1rem,2.2vw,1.15rem)] font-bold leading-[1.35] tracking-[-0.015em] text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.32)] max-[640px]:line-clamp-3 max-[640px]:text-[0.98rem] max-[640px]:leading-[1.32]">
                          {locale === "ko"
                            ? topic.titleKorean || topic.titleEnglish
                            : topic.titleEnglish || topic.titleKorean}
                        </h3>
                        <span className="mt-[0.6rem] inline-flex translate-y-[6px] items-center gap-[0.3rem] text-[0.82rem] uppercase tracking-[0.08em] text-white opacity-0 transition-[opacity,transform] duration-200 ease-[ease] group-hover:translate-y-0 group-hover:opacity-100 [&_svg]:h-[0.95rem] [&_svg]:w-[0.95rem] max-[640px]:translate-y-0 max-[640px]:text-[0.74rem] max-[640px]:opacity-[0.92] max-[640px]:group-hover:opacity-100">
                          {t.home.topicsShowcase.hoverPrompt}
                          <ArrowUpRightIcon />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
