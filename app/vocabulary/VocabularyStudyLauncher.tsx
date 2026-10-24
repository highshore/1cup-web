"use client";

import { useRouter } from "next/navigation";
import { AcademicCapIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";

export default function VocabularyStudyLauncher() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { locale } = useI18n();

  if (!currentUser) return null;

  return (
    <button
      type="button"
      className="fixed right-[max(1rem,calc((100vw-960px)/2+1rem))] bottom-5 z-[45] inline-flex items-center justify-center gap-[0.4rem] min-h-12 border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] py-[0.65rem] px-4 text-[0.82rem] font-[950] cursor-pointer shadow-[4px_4px_0_#050505] [transition:transform_150ms_ease,box-shadow_150ms_ease] hover:[transform:translate(-1px,-1px)] hover:shadow-[5px_5px_0_#050505] [&_svg]:w-[19px] [&_svg]:h-[19px] max-[640px]:right-[0.85rem] max-[640px]:bottom-[0.9rem]"
      onClick={() => router.push("/vocabulary/study")}
    >
      <AcademicCapIcon />
      {locale === "ko" ? "학습 시작" : "Start studying"}
    </button>
  );
}
