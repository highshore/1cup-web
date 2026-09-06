"use client";

import { TrophyIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../../i18n/I18nProvider";
import { HomeStats } from "../services/stats_service";

interface StatsSectionProps {
  stats?: HomeStats;
}

const metricItemClass =
  "flex min-w-0 flex-col items-start gap-[0.34rem] max-[860px]:items-center";

const metricValueClass =
  "text-[#050505] text-[clamp(2rem,4vw,2.5rem)] font-extrabold leading-none";

const metricLabelClass =
  "text-[rgba(5,5,5,0.72)] text-[0.9rem] font-medium leading-[1.25]";

export default function StatsSection({ stats }: StatsSectionProps) {
  const { t } = useI18n();
  const meetupCount = stats?.totalMeetups ?? 0;
  const memberCount = stats?.totalMembers ?? 0;

  return (
    <section className="relative z-[2] bg-transparent pt-6 pb-[clamp(4.5rem,8vw,6rem)]">
      <div className="mx-auto max-w-page px-5 max-[768px]:px-4">
        <div className="relative z-[2] flex flex-col items-center justify-center gap-5 rounded-[1.2rem] border-2 border-[#050505] bg-[#f47a4a] px-[1.4rem] py-[2.4rem] text-center text-[#050505] shadow-[7px_7px_0_#050505] min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between min-[900px]:gap-9 min-[900px]:px-12 min-[900px]:py-11 min-[900px]:text-left">
          <div className="flex w-full max-w-fit flex-col items-center gap-4 text-center">
            <TrophyIcon width={48} color="#050505" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <h3 className="m-0 text-[1.5rem] font-bold leading-[1.3] text-[#050505]">
              {t.home.stats.growth.title}
            </h3>
            <div className="mt-2 grid w-full grid-cols-[repeat(3,minmax(0,1fr))] items-start gap-[clamp(1rem,3vw,2rem)] max-[860px]:grid-cols-1 max-[860px]:gap-3 max-[860px]:text-center">
              <div className={metricItemClass}>
                <span className={metricValueClass}>
                  {meetupCount}
                  {t.home.stats.growth.valueSuffixes.meetups}
                </span>
                <span className={metricLabelClass}>{t.home.stats.growth.metrics.meetups}</span>
              </div>
              <div className={metricItemClass}>
                <span className={metricValueClass}>
                  {memberCount}
                  {t.home.stats.growth.valueSuffixes.members}
                </span>
                <span className={metricLabelClass}>{t.home.stats.growth.metrics.members}</span>
              </div>
              <div className={metricItemClass}>
                <span className={metricValueClass}>90%+</span>
                <span className={metricLabelClass}>{t.home.stats.growth.metrics.retention}</span>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <button className="cursor-pointer rounded-full border-2 border-[#050505] bg-[#fff8dc] px-6 py-3 font-bold text-[#050505] shadow-[4px_4px_0_rgba(5,5,5,0.92)] transition-[background-color,box-shadow,transform] duration-200 ease-[ease] hover:-translate-x-px hover:-translate-y-px hover:bg-white hover:shadow-[5px_5px_0_rgba(5,5,5,0.92)] max-[768px]:mt-4 max-[768px]:w-full">
              {t.home.stats.growth.cta}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
