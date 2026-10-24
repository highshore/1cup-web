import { useRouter } from "next/navigation";
import { RocketLaunchIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../lib/i18n/I18nProvider";

export default function CtaSection() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="w-full bg-[#f5f5f5] m-0 py-16 max-[768px]:py-12">
      <div className="max-w-page mx-auto px-6 max-[768px]:px-4">
        <div className="relative border-2 border-[#050505] rounded-[18px] p-12 text-center w-full overflow-hidden shadow-[6px_6px_0_rgba(5,5,5,0.92)] max-[768px]:p-8">
          <video
            className="absolute top-0 left-0 w-full h-full object-cover z-0"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src="/assets/blog/manhattan.mp4" type="video/mp4" />
          </video>
          <div className="absolute top-0 left-0 w-full h-full bg-[rgba(0,0,0,0.7)] z-[1]" />
          <div className="relative z-[2] max-w-[760px] mx-auto">
            <h3 className="text-[1.75rem] font-semibold text-white mb-4 [font-family:inherit] whitespace-pre-wrap max-[768px]:text-[1.25rem]">
              {t.home.cta.title}
            </h3>
            <p className="text-[1rem] text-[rgba(255,255,255,0.85)] mb-6 leading-[1.5] [font-family:inherit] whitespace-pre-wrap max-[768px]:text-[0.9rem]">
              {t.home.cta.description}
            </p>
            <button
              className="min-h-12 px-[1.55rem] py-[0.78rem] border-2 border-[#050505] rounded-full text-[1rem] font-[850] cursor-pointer [transition:background-color_160ms_ease,border-color_160ms_ease,box-shadow_160ms_ease,transform_160ms_ease] inline-flex items-center justify-center gap-2 relative overflow-hidden text-[#0f172a] [font-family:inherit] bg-white shadow-[5px_5px_0_#f47a4a] hover:bg-[#fff8dc] hover:border-[#050505] hover:shadow-[7px_7px_0_#f47a4a] hover:[transform:translate(-1px,-1px)] active:[transform:translateY(0)] [&_svg]:w-[1.1rem] [&_svg]:h-[1.1rem] max-[768px]:w-[min(100%,260px)] max-[768px]:px-[1.35rem] max-[768px]:py-3.5 max-[768px]:text-[0.9rem] max-[768px]:gap-1.5"
              onClick={() => router.push("/meetup")}
            >
              <RocketLaunchIcon />
              {t.home.cta.button}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
