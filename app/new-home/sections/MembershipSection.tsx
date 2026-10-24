import { useMemo, useCallback, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../lib/i18n/I18nProvider";

type CSSVariableStyle = CSSProperties & {
  ["--target-width"]?: string;
  ["--delay"]?: string;
};

interface CostComparison {
  key: string;
  label: string;
  cost: number;
  displayValue: string;
  color: string;
  highlight?: boolean;
}

export default function MembershipSection() {
  const { t, locale } = useI18n();
  const router = useRouter();

  const membershipSectionTitleLines = t.home.pricingNew.sectionTitle.split('\n');
  const membershipAccessBullet = useMemo(
    () => t.home.pricingNew.leftTitle.replace(/\n/g, " "),
    [t.home.pricingNew.leftTitle]
  );

  const formatCostValue = useCallback(
    (value: number) =>
      locale === "ko"
        ? `${value.toLocaleString("ko-KR")}원`
        : `${value.toLocaleString("en-US")} KRW`,
    [locale]
  );

  const costComparisons: CostComparison[] = useMemo(() => {
    const labels = t.home.pricingNew.chart.labels;
    return [
      {
        key: "oneCup",
        label: labels.oneCup,
        cost: 1212,
        displayValue: formatCostValue(1212),
        color: "linear-gradient(90deg, #050505, #2a2a2a)",
        highlight: true,
      },
      {
        key: "exchange",
        label: labels.exchange,
        cost: 5000,
        displayValue: formatCostValue(5000),
        color: "linear-gradient(90deg, #f47a4a, #f79a72)",
      },
      {
        key: "phone",
        label: labels.phone,
        cost: 20000,
        displayValue: `${formatCostValue(20000)}~`,
        color: "linear-gradient(90deg, #a6c9d8, #7fb1c5)",
      },
      {
        key: "academy",
        label: labels.academy,
        cost: 35000,
        displayValue: `${formatCostValue(35000)}~`,
        color: "linear-gradient(90deg, #d6c8aa, #bfae8b)",
      },
      {
        key: "premium",
        label: labels.premium,
        cost: 60000,
        displayValue: `${formatCostValue(60000)}~`,
        color: "linear-gradient(90deg, #8e9b8d, #6f806e)",
      },
    ];
  }, [formatCostValue, t, locale]);

  const maxCost = useMemo(
    () => Math.max(...costComparisons.map((item) => item.cost), 1),
    [costComparisons]
  );

  return (
    <section className="py-[clamp(4rem,8vw,5.5rem)] px-0 bg-[#f3f3f1] relative overflow-hidden text-[#050505]">
      <div className="max-w-page mx-auto px-5 max-[768px]:px-4 max-[768px]:text-center">
        <div className="grid grid-cols-1 gap-[clamp(1.5rem,4vw,2.25rem)] min-[860px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] min-[860px]:items-stretch">
          <div className="text-[#050505] flex flex-col justify-center gap-[1.15rem] relative z-[1] max-[768px]:text-center max-[768px]:items-center max-[768px]:w-full">
            <div className="grid gap-[0.8rem] max-[768px]:justify-items-center max-[768px]:text-center">
              <h2 className="m-0 text-[#050505] font-['Noto_Sans_KR',sans-serif] text-[clamp(1.85rem,3vw,2.4rem)] font-black leading-[1.18] tracking-[0] break-keep">
                {membershipSectionTitleLines[0]}
                {membershipSectionTitleLines[1] && (
                  <>
                    <br />
                    <span className="inline text-[#d95f2d]">
                      {membershipSectionTitleLines[1]}
                    </span>
                  </>
                )}
              </h2>
            </div>
            <div>
              <div className="flex flex-col gap-[0.55rem] w-full max-[768px]:max-w-[34rem]">
                {[membershipAccessBullet, t.home.pricingNew.referralDiscount].map((text, idx) => (
                  <p
                    key={idx}
                    className="text-[0.96rem] text-[rgba(5,5,5,0.76)] flex items-start gap-2 m-0 leading-[1.55] font-bold [&_svg]:mt-[0.12rem] [&_svg]:text-[#050505] max-[768px]:justify-center max-[768px]:text-center"
                  >
                    <CheckBadgeIcon width={20} className="shrink-0" />
                    {text}
                  </p>
                ))}
              </div>
              <div className="mt-[1.15rem] border border-[rgba(5,5,5,0.16)] rounded-xl bg-[rgba(255,255,255,0.68)] p-[0.9rem]">
                <p className="m-0 text-[rgba(5,5,5,0.62)] text-[0.82rem] font-[580] leading-[1.6] break-keep">
                  {t.home.pricingNew.caveats.line1}<br/>
                  {t.home.pricingNew.caveats.line2}<br/>
                  {t.home.pricingNew.caveats.line3}<br/>
                  {t.home.pricingNew.caveats.line4}
                </p>
              </div>
            </div>
            <button
              className="min-h-12 bg-white text-[#050505] font-[850] px-[1.55rem] py-[0.85rem] rounded-full [transition:background-color_160ms_ease,border-color_160ms_ease,box-shadow_160ms_ease,transform_160ms_ease] shadow-[5px_5px_0_#f47a4a] w-max border-2 border-[#050505] cursor-pointer text-[1rem] hover:bg-[#fff8dc] hover:border-[#050505] hover:[transform:translate(-1px,-1px)] hover:shadow-[7px_7px_0_#f47a4a] active:[transform:translateY(0)] max-[768px]:mx-auto"
              onClick={() => router.push("/payment")}
            >
              {t.home.pricing.cta}
            </button>
          </div>
          <div className="p-0 flex flex-col justify-center items-stretch relative z-[1] overflow-visible w-full max-[768px]:mt-6 max-[768px]:items-stretch">
            <div className="bg-white rounded-[10px] p-[clamp(1.05rem,2.5vw,1.4rem)] border-2 border-[#050505] shadow-[4px_4px_0_rgba(5,5,5,0.9)] [transition:border-color_180ms_ease,box-shadow_180ms_ease] relative overflow-hidden w-full max-w-none animate-[nh-chart-breath_5.2s_ease-in-out_infinite] motion-reduce:animate-none hover:border-[#050505] hover:shadow-[5px_5px_0_rgba(5,5,5,0.9)]">
              <div className="flex justify-between gap-4 mb-[1.1rem] pb-[0.8rem] border-b border-[rgba(5,5,5,0.12)] text-[0.86rem] font-[850] text-[#050505] relative z-[1]">
                <span>{t.home.pricingNew.chart.header}</span>
                <span>{t.home.pricingNew.chart.unit}</span>
              </div>
              <div className="flex flex-col gap-[0.82rem] relative z-[1]">
                {costComparisons.map((item, index) => {
                  const widthPercent = Math.max(
                    1.5,
                    (item.cost / maxCost) * 100
                  );
                  const barStyle: CSSVariableStyle = {
                    "--target-width": `${widthPercent}%`,
                    "--delay": `${index * 0.08}s`,
                  };
                  return (
                    <div
                      key={item.key}
                      className="flex flex-col gap-2 opacity-0 [transform:translateY(10px)] animate-[nh-fade-in-up_0.45s_ease_forwards]"
                      style={{ animationDelay: `${index * 0.08}s` }}
                    >
                      <div className="flex justify-between items-center gap-3 text-[0.86rem] text-[#050505] font-[760]">
                        <span
                          className={`text-[#050505] ${item.highlight ? "font-[920]" : "font-[760]"}`}
                        >
                          {item.label}
                        </span>
                        <span
                          className={`text-[0.85rem] whitespace-nowrap ${
                            item.highlight
                              ? "text-[#050505] font-[920]"
                              : "text-[rgba(5,5,5,0.58)] font-[650]"
                          }`}
                        >
                          {item.displayValue}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-[#fff8dc] rounded-full overflow-hidden border border-[rgba(5,5,5,0.16)] relative">
                        <div
                          className="relative h-full w-0 rounded-full animate-[nh-grow-bar_1.3s_cubic-bezier(0.22,1,0.36,1)_forwards] [animation-delay:var(--delay,0s)] shadow-none overflow-hidden"
                          style={{ ...barStyle, background: item.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
