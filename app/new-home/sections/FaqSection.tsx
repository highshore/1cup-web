import { useState } from "react";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { SectionTitle } from "../components/SectionHeading";

export default function FaqSection() {
  const { t } = useI18n();
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const FAQ_ITEMS = t.home.faq.items.map(item => ({ question: item.q, answer: item.a }));

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <section className="pt-20 pb-0 px-0 bg-[#f5f5f5] mb-0">
      <div className="max-w-page mx-auto px-6 max-[768px]:px-4">
        <SectionTitle>{t.home.faq.title}</SectionTitle>
        <div className="w-full flex flex-col gap-[1.2rem]">
          {FAQ_ITEMS.map((faq, index) => {
            const isOpen = openFAQ === index;
            return (
              <div
                key={index}
                className="rounded-2xl overflow-hidden bg-white border border-[#e5e7eb] [transition:all_0.2s_ease] hover:border-[#050505] hover:shadow-[4px_4px_0_rgba(5,5,5,0.9)]"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="flex justify-between items-center w-full p-6 bg-transparent border-none text-[1.05rem] font-semibold text-[#1f2937] cursor-pointer font-['Noto_Sans_KR',sans-serif] text-left [transition:color_0.2s_ease] hover:text-primary max-[768px]:p-[1.2rem] max-[768px]:text-[0.95rem]"
                >
                  {faq.question}
                  <span
                    className={`text-[1.4rem] font-normal text-primary [transition:transform_0.25s_ease] shrink-0 ml-4 ${
                      isOpen ? "[transform:rotate(180deg)]" : "[transform:none]"
                    }`}
                  >
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <div
                  className={`overflow-hidden [transition:max-height_0.3s_ease,padding_0.3s_ease] text-[0.95rem] text-[#6b7280] leading-[1.7] font-['Noto_Sans_KR',sans-serif] max-[768px]:text-[0.9rem] ${
                    isOpen
                      ? "max-h-[500px] pt-0 px-6 pb-6 max-[768px]:px-[1.2rem] max-[768px]:pb-[1.2rem]"
                      : "max-h-0 py-0 px-6 max-[768px]:px-[1.2rem]"
                  }`}
                >
                  {faq.answer}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
