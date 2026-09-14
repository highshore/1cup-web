"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HomeStats } from "../lib/features/home/services/stats_service";
import { useI18n } from "../lib/i18n/I18nProvider";
import { useAuth } from "../lib/contexts/auth_context";
import { supabase } from "../lib/supabase/client";

const pageContainerClass =
  "mx-auto w-full max-w-[1020px] px-6 max-[640px]:px-4";

const brandTagClass =
  "inline-flex min-h-[28px] items-center rounded-full border-2 border-[#050505] bg-[#f47a4a] px-3 py-1 text-[0.68rem] font-[900] tracking-[0.015em] text-[#050505]";

const buttonBaseClass =
  "inline-flex min-h-[50px] items-center justify-center rounded-full border-[2.5px] border-[#050505] px-5 py-3 text-[0.88rem] font-[900] no-underline transition-[transform,box-shadow,background-color] duration-150 hover:no-underline";

const primaryButtonClass = `${buttonBaseClass} bg-[#050505] text-white shadow-[5px_5px_0_#f47a4a] hover:-translate-x-px hover:-translate-y-px hover:text-white hover:shadow-[7px_7px_0_#f47a4a]`;
const secondaryButtonClass = `${buttonBaseClass} bg-[#fdf9ec] text-[#050505] shadow-[4px_4px_0_#050505] hover:-translate-x-px hover:-translate-y-px hover:bg-white hover:text-[#050505] hover:shadow-[6px_6px_0_#050505]`;

const formFieldClass =
  "grid gap-2 text-[0.72rem] font-[900] text-[#050505]";
const formInputClass =
  "min-h-[44px] w-full rounded-xl border border-[#dbdbd6] bg-[#fbfbfa] px-3 py-2.5 text-[0.8rem] font-[600] text-[#050505] outline-none focus:border-[#050505] focus:ring-2 focus:ring-[#f47a4a]/35";
const formNoticeClass = (success: boolean) =>
  `m-0 text-[0.78rem] font-[750] leading-[1.5] ${
    success ? "text-[#176b3a]" : "text-[#b42318]"
  }`;

const pageCopy = {
  en: {
    heroEyebrow: "FOR INTERNATIONAL MEMBERS",
    heroTitle: "Build a real circle in Seoul.",
    heroSubtitle:
      "Meet thoughtful Korean professionals and students through conversations that go beyond the usual language exchange.",
    membershipNote: "Membership fee waived for approved international members",
    photoMain: "Sunday discussion · Anam",
    photoSmall: "After-talk coffee",
    photoDinner: "Member dinner",
    photoWide: "Tech · society · business",
    photoSubtitle: "1 Cup member meetup",
    proof: {
      meetups: "Meetups hosted",
      members: "Community members",
      retention: "Repeat participation",
      review: "Application review",
    },
    whyEyebrow: "WHY CHOOSE US",
    whyTitle: "Not another language exchange.",
    whyDescription:
      "Come for a real conversation. Come back because the people start feeling familiar.",
    benefits: [
      {
        title: "Conversations worth showing up for",
        description:
          "Tech, business, society and culture — guided by prepared discussion topics and led by facilitators, not random icebreakers.",
      },
      {
        title: "Meet people outside the expat bubble",
        description:
          "Build relationships with Korean professionals you would rarely meet through ordinary international events.",
      },
      {
        title: "See familiar faces again",
        description:
          "Recurring meetups create continuity. You are not restarting from zero with a new room every week.",
      },
    ],
    bringTag: "WHAT YOU BRING",
    bringTitle: "Perspective, fluent English, curiosity.",
    bringDescription:
      "You help make the room more globally interesting simply by showing up as yourself and engaging seriously.",
    getTag: "WHAT YOU GET",
    getTitle: "A curated Korean professional circle.",
    getDescription:
      "Approved international members join without a membership fee and get access to recurring community meetups.",
    fitTitle: "You’ll probably love 1 Cup if…",
    fitDescription:
      "These are signals, not a rigid checklist. We review applications individually.",
    eligibility: [
      {
        title: "English is your first language",
        description: "You grew up primarily speaking English.",
      },
      {
        title: "You’re building a life in Korea",
        description:
          "You work, study professionally, or are rooted here beyond a short trip.",
      },
      {
        title: "You plan to stay",
        description:
          "Longer-term residents create the continuity the community depends on.",
      },
      {
        title: "You actually like discussion",
        description:
          "You are curious, respectful, and happy to engage beyond surface-level networking.",
      },
    ],
    applicationTag: "APPLICATION",
    applicationTitle: "A quick application. A considered community.",
    applicationDescription:
      "We keep this lightweight. The goal is simply to make sure the room works for everyone who joins.",
    steps: [
      ["Create your account", "~30 seconds"],
      ["Tell us about yourself", "~2 minutes"],
      ["We review your application", "Usually within 3 days"],
      ["Join your first meetup", "You’ll get next-step instructions"],
    ],
    formTitle: "Apply as an International Member",
    formSubtitle: "Takes about 2 minutes · Reviewed by a real person",
    formPolicy: "By applying, you agree to our community guidelines and privacy policy.",
    credentialLabel: "LinkedIn or another profile",
    credentialPlaceholder: "https://www.linkedin.com/in/your-profile",
    invalidCredential: "Enter a valid HTTPS URL.",
    faqTag: "FAQ",
    faqTitle: "A few things people usually ask.",
    faq: [
      [
        "Is membership really free?",
        "For approved international members, yes. The waived fee reflects the value international members bring to the discussion community.",
      ],
      [
        "Do I need to be a native speaker?",
        "The current international-member pathway is designed around native-level English contribution. Applications are still reviewed individually.",
      ],
      ["Do I need to speak Korean?", "No. Meetups are conducted in English. Korean ability is not required."],
      [
        "What happens after approval?",
        "You’ll receive instructions for booking an upcoming meetup and completing your member profile.",
      ],
      [
        "Can exchange students apply?",
        "You can apply, but we prioritize people likely to stay in Korea long enough to become recurring members.",
      ],
      [
        "Why is there an application at all?",
        "Because continuity and group fit matter more to us than maximizing headcount.",
      ],
    ],
    finalTag: "READY WHEN YOU ARE",
    finalTitle: "Find your people in Seoul.",
    finalDescription:
      "If you want conversations with substance and a community you can actually return to, we’d like to meet you.",
    applyNow: "Apply now →",
    browseMeetups: "Browse upcoming meetups",
  },
  ko: {
    heroEyebrow: "외국인 멤버 안내",
    heroTitle: "서울에서 진짜 내 사람들을 만나보세요.",
    heroSubtitle:
      "흔한 언어교환을 넘어, 생각 있는 한국 직장인과 학생들을 깊이 있는 대화로 만나보세요.",
    membershipNote: "승인된 외국인 멤버는 멤버십 비용이 면제됩니다",
    photoMain: "일요일 디스커션 · 안암",
    photoSmall: "밋업 후 커피",
    photoDinner: "멤버 저녁 모임",
    photoWide: "테크 · 사회 · 비즈니스",
    photoSubtitle: "영어 한잔 멤버 밋업",
    proof: {
      meetups: "누적 밋업",
      members: "커뮤니티 멤버",
      retention: "재참여율",
      review: "지원서 검토",
    },
    whyEyebrow: "WHY CHOOSE US",
    whyTitle: "또 하나의 언어교환 모임이 아닙니다.",
    whyDescription:
      "좋은 대화를 위해 오고, 익숙해진 사람들 때문에 다시 찾는 커뮤니티를 지향합니다.",
    benefits: [
      {
        title: "기꺼이 시간을 내고 싶은 대화",
        description:
          "기술, 비즈니스, 사회, 문화 주제를 준비된 질문과 리더의 진행으로 깊이 있게 이야기합니다.",
      },
      {
        title: "외국인 커뮤니티 밖의 사람들",
        description:
          "일반적인 국제 교류 행사에서는 만나기 어려운 한국 직장인들과 관계를 만들어갑니다.",
      },
      {
        title: "다시 만나는 익숙한 얼굴들",
        description:
          "정기적인 밋업으로 매번 처음부터 관계를 시작하지 않아도 되는 연속성을 만듭니다.",
      },
    ],
    bringTag: "WHAT YOU BRING",
    bringTitle: "관점, 유창한 영어, 호기심.",
    bringDescription:
      "있는 그대로 참여하고 진지하게 대화하는 것만으로도 커뮤니티에 더 넓은 관점을 더할 수 있습니다.",
    getTag: "WHAT YOU GET",
    getTitle: "엄선된 한국의 프로페셔널 커뮤니티.",
    getDescription:
      "승인된 외국인 멤버는 멤버십 비용 없이 정기 커뮤니티 밋업에 참여할 수 있습니다.",
    fitTitle: "이런 분이라면 영어 한잔이 잘 맞을 거예요.",
    fitDescription: "절대적인 체크리스트가 아니라 참고 기준이며, 지원서는 개별 검토합니다.",
    eligibility: [
      {
        title: "영어가 모국어예요",
        description: "어릴 때부터 영어를 주된 언어로 사용해왔습니다.",
      },
      {
        title: "한국에서 삶을 만들어가고 있어요",
        description: "한국에서 일하거나 전문적으로 공부하며 단기 방문 이상의 기반이 있습니다.",
      },
      {
        title: "한국에 장기 체류할 계획이에요",
        description: "장기 체류 멤버가 커뮤니티의 지속적인 관계를 만들어줍니다.",
      },
      {
        title: "대화 자체를 좋아해요",
        description: "호기심과 존중을 바탕으로 가벼운 네트워킹 이상의 대화를 즐깁니다.",
      },
    ],
    applicationTag: "APPLICATION",
    applicationTitle: "지원은 가볍게. 커뮤니티는 신중하게.",
    applicationDescription:
      "지원 과정은 간단합니다. 함께하는 공간이 모두에게 잘 맞는지만 확인합니다.",
    steps: [
      ["계정 만들기", "약 30초"],
      ["간단한 정보 알려주기", "약 2분"],
      ["지원서 검토", "보통 3일 이내"],
      ["첫 밋업 참여", "다음 단계를 이메일로 안내"],
    ],
    formTitle: "외국인 멤버 지원하기",
    formSubtitle: "약 2분 소요 · 운영진이 직접 검토합니다",
    formPolicy: "지원 시 커뮤니티 가이드라인 및 개인정보 처리방침에 동의하게 됩니다.",
    credentialLabel: "LinkedIn 또는 경력을 확인할 수 있는 프로필",
    credentialPlaceholder: "https://www.linkedin.com/in/your-profile",
    invalidCredential: "유효한 HTTPS URL을 입력해 주세요.",
    faqTag: "FAQ",
    faqTitle: "자주 묻는 질문",
    faq: [
      ["멤버십이 정말 무료인가요?", "승인된 외국인 멤버는 멤버십 비용이 면제됩니다."],
      ["영어 원어민이어야 하나요?", "현재 외국인 멤버 경로는 원어민 수준의 영어 기여를 기준으로 하며, 지원서는 개별 검토합니다."],
      ["한국어를 해야 하나요?", "아니요. 밋업은 영어로 진행되며 한국어 능력은 필수가 아닙니다."],
      ["승인 후에는 어떻게 되나요?", "밋업 예약과 멤버 프로필 작성을 위한 다음 단계를 안내드립니다."],
      ["교환학생도 지원할 수 있나요?", "지원할 수 있지만, 장기적으로 반복 참여할 가능성이 높은 분을 우선 검토합니다."],
      ["왜 지원 절차가 있나요?", "인원 수보다 커뮤니티의 지속성과 그룹 적합성을 더 중요하게 보기 때문입니다."],
    ],
    finalTag: "READY WHEN YOU ARE",
    finalTitle: "서울에서 내 사람들을 만나보세요.",
    finalDescription:
      "내용 있는 대화와 다시 돌아오고 싶은 커뮤니티를 찾고 있다면, 영어 한잔에서 만나고 싶습니다.",
    applyNow: "지금 지원하기 →",
    browseMeetups: "예정된 밋업 보기",
  },
} as const;

function approximateMetric(value: number | undefined, fallback: number) {
  if (!value || value <= 0) return `${fallback}+`;
  return `${Math.max(fallback, Math.floor(value / 10) * 10)}+`;
}

function PersonCard({
  className = "",
  tone,
  label,
  subtitle,
  compact = false,
}: {
  className?: string;
  tone: string;
  label: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border-2 border-[#050505] ${tone} ${className}`}
      aria-label={label}
    >
      <div
        className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-[#c79272] ${
          compact ? "top-[18%] h-10 w-10" : "top-[17%] h-16 w-16"
        }`}
        aria-hidden="true"
      />
      <div
        className={`absolute left-1/2 -translate-x-1/2 rounded-t-[999px] bg-[#28313d] ${
          compact
            ? "top-[38%] h-[75%] w-[72%]"
            : "top-[39%] h-[76%] w-[72%]"
        }`}
        aria-hidden="true"
      />
      <div className="absolute inset-x-3 bottom-3 rounded-[13px] border-[1.5px] border-[#050505] bg-white px-3 py-2">
        <p className="m-0 text-[0.68rem] font-[900] leading-[1.3] text-[#050505]">{label}</p>
        <p className="mt-0.5 mb-0 text-[0.56rem] font-[650] leading-[1.3] text-[#64748b]">{subtitle}</p>
      </div>
    </div>
  );
}

function PhotoCollage({ copy }: { copy: (typeof pageCopy)["en"] | (typeof pageCopy)["ko"] }) {
  return (
    <div className="grid h-[470px] grid-cols-[1.65fr_1fr] grid-rows-[1.15fr_0.85fr] gap-4 max-[860px]:h-[190px] max-[860px]:grid-cols-1 max-[860px]:grid-rows-1">
      <PersonCard
        tone="bg-[#d1c7b0]"
        label={copy.photoMain}
        subtitle={copy.photoSubtitle}
        className="max-[860px]:h-[190px]"
      />
      <PersonCard
        tone="bg-[#bfc7b2]"
        label={copy.photoSmall}
        subtitle={copy.photoSubtitle}
        compact
        className="max-[860px]:hidden"
      />
      <PersonCard
        tone="bg-[#fff0e8]"
        label={copy.photoDinner}
        subtitle={copy.photoSubtitle}
        compact
        className="max-[860px]:hidden"
      />
      <PersonCard
        tone="bg-[#fdf9ec]"
        label={copy.photoWide}
        subtitle={copy.photoSubtitle}
        className="max-[860px]:hidden"
      />
    </div>
  );
}

interface NonKoreanApplicantsClientProps {
  stats?: HomeStats;
}

export default function NonKoreanApplicantsClient({ stats }: NonKoreanApplicantsClientProps) {
  const { t, locale } = useI18n();
  const { currentUser, isLoading: authLoading } = useAuth();
  const applicationRef = useRef<HTMLElement | null>(null);
  const [email, setEmail] = useState("");
  const [nationality, setNationality] = useState("");
  const [credentialUrl, setCredentialUrl] = useState("");
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const page = t.nonKoreanApplicants;
  const application = page.application;
  const copy = locale === "ko" ? pageCopy.ko : pageCopy.en;
  const authHref = "/auth?redirect=%2Fnon-korean-applicants%23application";
  const meetupMetric = approximateMetric(stats?.totalMeetups, 80);
  const memberMetric = approximateMetric(stats?.totalMembers, 70);

  useEffect(() => {
    if (authLoading || !currentUser) {
      setLoadingApplication(false);
      return;
    }

    let active = true;
    setLoadingApplication(true);

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("non_korean_applications")
          .select("email, nationality, linkedin_url, status")
          .eq("user_id", currentUser.uid)
          .maybeSingle();

        if (!active) return;
        if (error) {
          console.error("Unable to load non-Korean application:", error);
          setFormMessage({ tone: "error", text: application.form.loadError });
          return;
        }

        setEmail(data?.email ?? currentUser.email ?? "");
        setNationality(data?.nationality ?? "");
        setCredentialUrl(data?.linkedin_url ?? "");
        setApplicationStatus(data?.status ?? null);
      } finally {
        if (active) setLoadingApplication(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [application.form.loadError, authLoading, currentUser]);

  const scrollToApplication = () => {
    applicationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleApply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || submitting) return;

    const normalizedEmail = email.trim();
    const normalizedNationality = nationality.trim();
    const normalizedCredentialUrl = credentialUrl.trim();

    let isCredentialUrl = false;
    try {
      const parsedUrl = new URL(normalizedCredentialUrl);
      isCredentialUrl = parsedUrl.protocol === "https:" && Boolean(parsedUrl.hostname);
    } catch {
      isCredentialUrl = false;
    }

    if (!isCredentialUrl) {
      setFormMessage({ tone: "error", text: copy.invalidCredential });
      return;
    }

    setSubmitting(true);
    setFormMessage(null);

    try {
      const { data, error } = await supabase
        .from("non_korean_applications")
        .upsert(
          {
            user_id: currentUser.uid,
            email: normalizedEmail,
            nationality: normalizedNationality,
            linkedin_url: normalizedCredentialUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        .select("status")
        .single();

      if (error) throw error;
      setApplicationStatus(data.status);
      setFormMessage({ tone: "success", text: application.form.success });
    } catch (error) {
      console.error("Unable to submit non-Korean application:", error);
      setFormMessage({ tone: "error", text: application.form.error });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f3ed] text-[#050505]">
      <div className={pageContainerClass}>
        <section className="grid grid-cols-[500px_minmax(0,1fr)] items-center gap-11 pt-12 pb-10 max-[1080px]:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] max-[860px]:grid-cols-1 max-[860px]:gap-7 max-[860px]:pt-7 max-[640px]:pb-7">
          <div className="flex flex-col items-start max-[860px]:items-stretch">
            <span className={`${brandTagClass} mb-5 max-[860px]:self-start`}>{copy.heroEyebrow}</span>
            <h1 className="m-0 max-w-[500px] text-[clamp(2.65rem,4.25vw,3.25rem)] font-[950] leading-[1.07] tracking-[-0.035em] text-[#050505] max-[640px]:text-[2.35rem]">
              {copy.heroTitle}
            </h1>
            <p className="mt-4 mb-0 max-w-[470px] text-[1.08rem] font-[600] leading-[1.55] text-[#050505] max-[640px]:text-[1rem]">
              {copy.heroSubtitle}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 max-[640px]:grid max-[640px]:w-full max-[640px]:grid-cols-1">
              {currentUser ? (
                <Link className={primaryButtonClass} href="#application" onClick={scrollToApplication}>
                  {page.hero.primaryCta} →
                </Link>
              ) : (
                <Link className={primaryButtonClass} href={authHref}>
                  {page.hero.primaryCta} →
                </Link>
              )}
              <Link className={secondaryButtonClass} href="/meetup">
                {page.hero.secondaryCta}
              </Link>
            </div>
            <p className="mt-5 mb-0 text-[0.72rem] font-[700] leading-[1.5] text-[#64748b]">
              ✓ {copy.membershipNote}
            </p>
          </div>
          <PhotoCollage copy={copy} />
        </section>

        <section className="grid grid-cols-4 rounded-[22px] border-2 border-[#050505] bg-white px-7 py-6 shadow-[4px_4px_0_rgba(5,5,5,0.16)] max-[640px]:grid-cols-2 max-[640px]:px-3 max-[640px]:py-4">
          {[
            [meetupMetric, copy.proof.meetups],
            [memberMetric, copy.proof.members],
            ["90%+", copy.proof.retention],
            ["~3 days", copy.proof.review],
          ].map(([value, label], index) => (
            <div
              key={label}
              className={`flex min-h-[62px] flex-col items-center justify-center px-3 text-center max-[640px]:min-h-[78px] ${
                index % 2 === 0 ? "max-[640px]:border-r max-[640px]:border-[#dbdbd6]" : ""
              } ${index < 2 ? "max-[640px]:border-b max-[640px]:border-[#dbdbd6]" : ""}`}
            >
              <strong className="text-[1.65rem] font-[950] leading-none text-[#050505] max-[640px]:text-[1.35rem]">{value}</strong>
              <span className="mt-2 text-[0.72rem] font-[750] text-[#64748b] max-[640px]:text-[0.62rem]">{label}</span>
            </div>
          ))}
        </section>

        <section className="pt-16 pb-12 max-[640px]:pt-12 max-[640px]:pb-10">
          <span className={brandTagClass}>{copy.whyEyebrow}</span>
          <h2 className="mt-4 mb-0 text-[2.25rem] font-[950] leading-[1.15] tracking-[-0.025em] max-[640px]:text-[1.8rem]">{copy.whyTitle}</h2>
          <p className="mt-2 mb-0 max-w-[620px] text-[0.95rem] font-[600] leading-[1.6] text-[#64748b]">{copy.whyDescription}</p>
          <div className="mt-8 grid grid-cols-3 gap-[18px] max-[760px]:grid-cols-1 max-[760px]:gap-3">
            {copy.benefits.map((benefit, index) => (
              <article
                key={benefit.title}
                className={`min-h-[308px] rounded-[24px] border-2 border-[#050505] p-[22px] max-[760px]:min-h-0 max-[760px]:rounded-[20px] max-[760px]:p-4 ${
                  index === 0 ? "bg-[#fff0e8]" : index === 1 ? "bg-[#fdf9ec]" : "bg-[#e8eddb]"
                }`}
              >
                <span className="inline-grid h-[42px] w-[42px] place-items-center rounded-full border-[1.5px] border-[#050505] bg-white text-[0.75rem] font-[950] max-[760px]:h-auto max-[760px]:w-auto max-[760px]:place-items-start max-[760px]:border-0 max-[760px]:bg-transparent max-[760px]:text-[#f47a4a]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 mb-0 text-[1.35rem] font-[950] leading-[1.25] max-[760px]:mt-2 max-[760px]:text-[1rem]">{benefit.title}</h3>
                <p className="mt-5 mb-0 text-[0.82rem] font-[600] leading-[1.55] text-[#64748b] max-[760px]:mt-2 max-[760px]:text-[0.68rem]">{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pb-12 max-[640px]:pb-10">
          <div className="grid grid-cols-2 rounded-[24px] border-2 border-[#050505] bg-white shadow-[4px_4px_0_rgba(5,5,5,0.09)] max-[760px]:grid-cols-1">
            <div className="p-6 max-[760px]:pb-5">
              <span className={brandTagClass}>{copy.bringTag}</span>
              <h3 className="mt-3 mb-0 text-[1.32rem] font-[950] leading-[1.35]">{copy.bringTitle}</h3>
              <p className="mt-2 mb-0 text-[0.78rem] font-[600] leading-[1.6] text-[#64748b]">{copy.bringDescription}</p>
            </div>
            <div className="border-l-2 border-[#dbdbd6] p-6 max-[760px]:border-t-2 max-[760px]:border-l-0">
              <span className={brandTagClass}>{copy.getTag}</span>
              <h3 className="mt-3 mb-0 text-[1.32rem] font-[950] leading-[1.35]">{copy.getTitle}</h3>
              <p className="mt-2 mb-0 text-[0.78rem] font-[600] leading-[1.6] text-[#64748b]">{copy.getDescription}</p>
            </div>
          </div>

          <h2 className="mt-8 mb-0 text-[1.8rem] font-[950] leading-[1.2] tracking-[-0.02em] max-[640px]:text-[1.5rem]">{copy.fitTitle}</h2>
          <p className="mt-2 mb-0 text-[0.75rem] font-[600] leading-[1.5] text-[#64748b]">{copy.fitDescription}</p>
          <div className="mt-5 grid grid-cols-4 gap-3 max-[760px]:grid-cols-2 max-[420px]:gap-2">
            {copy.eligibility.map((item, index) => (
              <article key={item.title} className="min-h-[212px] rounded-[20px] border-2 border-[#050505] bg-white p-4 shadow-[2px_2px_0_rgba(5,5,5,0.06)] max-[640px]:min-h-[148px] max-[640px]:rounded-[18px] max-[640px]:border-[1.5px] max-[640px]:p-3">
                <span className="text-[0.68rem] font-[950] text-[#f47a4a]">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 mb-0 text-[1.05rem] font-[950] leading-[1.25] max-[640px]:text-[0.88rem]">{item.title}</h3>
                <p className="mt-3 mb-0 text-[0.72rem] font-[600] leading-[1.5] text-[#64748b] max-[640px]:mt-2 max-[640px]:text-[0.62rem]">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          ref={applicationRef}
          id="application"
          className="scroll-mt-24 rounded-[28px] bg-[#050505] p-9 shadow-[5px_5px_0_rgba(244,122,74,0.16)] max-[760px]:rounded-[24px] max-[760px]:p-5"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_482px] gap-9 max-[900px]:grid-cols-1">
            <div>
              <span className={brandTagClass}>{copy.applicationTag}</span>
              <h2 className="mt-5 mb-0 max-w-[430px] text-[1.8rem] font-[950] leading-[1.2] tracking-[-0.02em] text-white max-[640px]:text-[1.7rem]">{copy.applicationTitle}</h2>
              <p className="mt-4 mb-0 max-w-[410px] text-[0.88rem] font-[600] leading-[1.55] text-[#c2c2c2]">{copy.applicationDescription}</p>
              <div className="mt-9 grid gap-6 max-[900px]:mb-8">
                {copy.steps.map(([title, detail], index) => (
                  <div key={title} className="grid grid-cols-[38px_1fr] items-center gap-3">
                    <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[#f47a4a] text-[0.65rem] font-[950] text-[#050505]">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <p className="m-0 text-[0.84rem] font-[900] text-white">{title}</p>
                      <p className="mt-1 mb-0 text-[0.67rem] font-[600] text-[#a6a6a6]">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] bg-white p-6 max-[640px]:rounded-[18px] max-[640px]:p-5">
              <h3 className="m-0 text-[1.5rem] font-[950] leading-[1.25] max-[640px]:text-[1.2rem]">{copy.formTitle}</h3>
              <p className="mt-2 mb-0 text-[0.68rem] font-[600] text-[#64748b]">{copy.formSubtitle}</p>

              {authLoading || loadingApplication ? (
                <div className="mt-7 h-[248px] animate-pulse rounded-xl bg-[#f5f3ed]" aria-hidden="true" />
              ) : currentUser ? (
                <form className="mt-6 grid gap-4" onSubmit={handleApply}>
                  <label className={formFieldClass}>
                    {application.form.emailLabel}
                    <input
                      className={formInputClass}
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={application.form.emailPlaceholder}
                      maxLength={320}
                      required
                    />
                  </label>
                  <label className={formFieldClass}>
                    {application.form.nationalityLabel}
                    <input
                      className={formInputClass}
                      type="text"
                      autoComplete="country-name"
                      value={nationality}
                      onChange={(event) => setNationality(event.target.value)}
                      placeholder={application.form.nationalityPlaceholder}
                      maxLength={100}
                      required
                    />
                  </label>
                  <label className={formFieldClass}>
                    {copy.credentialLabel}
                    <input
                      className={formInputClass}
                      type="url"
                      autoComplete="url"
                      value={credentialUrl}
                      onChange={(event) => setCredentialUrl(event.target.value)}
                      placeholder={copy.credentialPlaceholder}
                      maxLength={500}
                      required
                    />
                  </label>
                  {applicationStatus ? <p className={formNoticeClass(true)}>{application.form.submitted}</p> : null}
                  {formMessage ? (
                    <p className={formNoticeClass(formMessage.tone === "success")} aria-live="polite">
                      {formMessage.text}
                    </p>
                  ) : null}
                  <p className="m-0 text-[0.62rem] font-[600] leading-[1.5] text-[#64748b]">{copy.formPolicy}</p>
                  <button
                    className="min-h-[50px] cursor-pointer rounded-full border-[2.5px] border-[#050505] bg-[#050505] px-5 text-[0.82rem] font-[950] text-white shadow-[5px_5px_0_#f47a4a] transition-transform hover:-translate-x-px hover:-translate-y-px disabled:cursor-wait disabled:opacity-60"
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting ? application.form.submitting : application.form.submit}
                  </button>
                </form>
              ) : (
                <div className="mt-7 rounded-[18px] border border-[#dbdbd6] bg-[#fbfbfa] p-5">
                  <p className="m-0 text-[0.84rem] font-[700] leading-[1.55] text-[#64748b]">{application.signInHint}</p>
                  <Link className={`${primaryButtonClass} mt-5 w-full`} href={authHref}>
                    {application.signInCta} →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="py-16 max-[640px]:py-12">
          <span className={brandTagClass}>{copy.faqTag}</span>
          <h2 className="mt-4 mb-0 text-[1.9rem] font-[950] leading-[1.2] max-[640px]:text-[1.6rem]">{copy.faqTitle}</h2>
          <div className="mt-7 grid grid-cols-2 gap-3 max-[700px]:grid-cols-1">
            {copy.faq.map(([question, answer]) => (
              <article key={question} className="min-h-[100px] rounded-[18px] border-[1.5px] border-[#050505] bg-white p-4 max-[640px]:min-h-[78px] max-[640px]:rounded-[16px] max-[640px]:p-3.5">
                <h3 className="m-0 text-[0.88rem] font-[950] leading-[1.35] max-[640px]:text-[0.75rem]">{question}</h3>
                <p className="mt-2 mb-0 text-[0.74rem] font-[600] leading-[1.45] text-[#64748b] max-[640px]:text-[0.62rem]">{answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-16 rounded-[28px] border-2 border-[#050505] bg-[#fff0e8] p-10 shadow-[5px_5px_0_rgba(5,5,5,0.14)] max-[640px]:mb-10 max-[640px]:rounded-[24px] max-[640px]:p-5">
          <span className={brandTagClass}>{copy.finalTag}</span>
          <h2 className="mt-5 mb-0 text-[2.35rem] font-[950] leading-[1.15] tracking-[-0.025em] max-[640px]:text-[1.85rem]">{copy.finalTitle}</h2>
          <p className="mt-3 mb-0 max-w-[700px] text-[0.88rem] font-[600] leading-[1.55] text-[#64748b]">{copy.finalDescription}</p>
          <div className="mt-7 flex flex-wrap gap-4 max-[640px]:grid max-[640px]:grid-cols-1">
            {currentUser ? (
              <Link className={primaryButtonClass} href="#application" onClick={scrollToApplication}>
                {copy.applyNow}
              </Link>
            ) : (
              <Link className={primaryButtonClass} href={authHref}>
                {copy.applyNow}
              </Link>
            )}
            <Link className={secondaryButtonClass} href="/meetup">
              {copy.browseMeetups}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
