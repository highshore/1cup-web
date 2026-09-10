"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AcademicCapIcon,
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import StatsSection from "../lib/features/home/components/StatsSection";
import { HomeStats } from "../lib/features/home/services/stats_service";
import { useI18n } from "../lib/i18n/I18nProvider";
import { useAuth } from "../lib/contexts/auth_context";
import { supabase } from "../lib/supabase/client";

const containerClass =
  "mx-auto w-[min(var(--container-page),calc(100%-3rem))] max-[768px]:w-[calc(100%-2rem)]";

const eyebrowClass =
  "mb-4 inline-block rounded-full border-2 border-[#050505] bg-[#f47a4a] px-[0.68rem] py-[0.3rem] text-[0.72rem] font-[900] tracking-[0.02em] text-[#050505]";

const heroActionsClass =
  "mt-[1.55rem] flex flex-wrap items-center gap-[0.7rem] max-[860px]:justify-center";

const pillButtonBase =
  "inline-flex min-h-[46px] items-center justify-center rounded-full border-2 px-[1.05rem] py-[0.66rem] text-[0.88rem] font-[900] no-underline hover:no-underline";

const primaryButtonClass = `${pillButtonBase} border-[#050505] bg-[#050505] text-white shadow-[5px_5px_0_#f47a4a] [transition:transform_180ms_ease,box-shadow_180ms_ease] hover:-translate-x-px hover:-translate-y-px hover:text-white hover:shadow-[7px_7px_0_#f47a4a]`;

const secondaryButtonClass = `${pillButtonBase} border-[#050505] bg-[#fff8dc] text-[#050505] hover:bg-white hover:text-[#050505]`;

const invertedButtonClass = `${pillButtonBase} border-white bg-white text-[#050505] hover:bg-[#fff8dc] hover:text-[#050505]`;

const ghostButtonClass = `${pillButtonBase} border-[rgba(255,255,255,0.5)] bg-transparent text-white hover:border-white hover:text-white`;

const sectionClass = "py-[clamp(2.75rem,5vw,3.75rem)]";

const sectionHeaderClass =
  "mb-[clamp(1.35rem,3vw,2rem)] max-w-[42rem] max-[768px]:mx-auto max-[768px]:text-center";

const sectionTitleClass =
  "m-0 text-[clamp(1.65rem,3vw,2.35rem)] font-[950] leading-[1.12] text-[#050505]";

const sectionDescriptionClass =
  "mt-3 mb-0 text-[0.96rem] font-[590] leading-[1.65] text-[rgba(5,5,5,0.68)]";

const formFieldClass =
  "grid gap-[0.42rem] text-[0.84rem] font-[850] text-[#050505]";

const formInputClass =
  "min-h-[46px] w-full rounded-lg border-[1.5px] border-[#050505] bg-white px-3 py-[0.65rem] [font-family:inherit] text-[0.92rem] text-[#050505] focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f47a4a]";

const formNoticeClass = (success: boolean) =>
  `m-0 text-[0.88rem] font-[720] leading-[1.5] ${
    success ? "text-[#176b3a]" : "text-[#b42318]"
  }`;

const pageCopy = {
  en: {
    heroEyebrow: "For Non-Korean Members",
    heroTitle: "Build a Quality Korean Network.",
    heroSubtitle:
      "Are you staying in Korea long-term? Are you tired of fleeting exchanges and looking to build a more meaningful network? At our meetups, you can connect with English-speaking Korean professionals and students through interesting conversations.",
    networkAnimationLabel: "Animated illustration of people building a professional network",
    statsTitle: "A meetup with a steady flow of trusted members",
    eligibilityDescription:
      "We are looking for native English speakers who can add value to our meetup community. You may still apply even if you do not meet all of the criteria below, but approval is not guaranteed.",
    nativeSpeakerDescription:
      "You are a native English speaker from one of the following core English-speaking countries.",
    professionalDescription:
      "You are currently working at a company, institution, or professional organization. The meetup is not designed for stays mainly based on short-term teaching, military service, exchange study, tourism, or temporary travel.",
    firstBenefit:
      "Network with intelligent, kind, and hard-working Koreans in a relaxed English-speaking environment.",
    credentialLabel: "LinkedIn Profile URL or any link that can prove your credentials",
    credentialPlaceholder: "https://www.linkedin.com/in/your-profile",
    invalidCredential: "Enter a valid HTTPS URL.",
    processCredentialDescription:
      "Please submit your email address, nationality, and a LinkedIn profile or another link that can verify your credentials. We use these to contact you and review your fit with our meetup.",
  },
  ko: {
    heroEyebrow: "외국인 멤버 안내",
    heroTitle: "한국에서 좋은 네트워크를 만들어보세요.",
    heroSubtitle:
      "한국에 장기 체류할 예정인가요? 일회성 만남에 지쳤고 더 진지한 네트워크를 만들고 싶나요? 영어 한잔에서는 흥미로운 대화를 통해 영어로 소통할 수 있는 한국의 직장인과 학생들을 만날 수 있습니다.",
    networkAnimationLabel: "사람들이 전문적인 네트워크를 만들어가는 애니메이션",
    statsTitle: "신뢰할 수 있는 멤버들이 꾸준히 참여하는 모임",
    eligibilityDescription:
      "밋업에 가치를 더할 수 있는 영어 원어민을 찾고 있습니다. 아래 조건을 모두 충족하지 않더라도 지원할 수 있지만, 승인이 보장되지는 않습니다.",
    nativeSpeakerDescription:
      "아래 주요 영어권 국가 출신의 영어 원어민을 찾고 있습니다.",
    professionalDescription:
      "현재 기업, 기관 또는 전문 조직에서 근무하고 있어야 합니다. 본 밋업은 단기 영어 교육, 군 복무, 교환학생, 관광 또는 임시 여행을 주된 체류 목적으로 하는 분들을 위한 모임은 아닙니다.",
    firstBenefit:
      "지적이고 친절하며 성실한 한국인들과 편안한 영어 환경에서 네트워킹할 수 있습니다.",
    credentialLabel: "LinkedIn 프로필 URL 또는 경력을 확인할 수 있는 기타 링크",
    credentialPlaceholder: "https://www.linkedin.com/in/your-profile",
    invalidCredential: "유효한 HTTPS URL을 입력해 주세요.",
    processCredentialDescription:
      "이메일 주소, 국적, LinkedIn 프로필 또는 경력을 확인할 수 있는 다른 링크를 제출해 주세요. 연락 및 밋업 적합성 검토를 위해 사용합니다.",
  },
} as const;

function NetworkingAnimation({ label }: { label: string }) {
  const nodeClass =
    "absolute grid h-[4.4rem] w-[4.4rem] place-items-center rounded-full border-2 border-[#050505] bg-[#fff8dc] shadow-[4px_4px_0_#050505] max-[520px]:h-[3.7rem] max-[520px]:w-[3.7rem]";
  const iconClass = "h-8 w-8 text-[#050505] max-[520px]:h-7 max-[520px]:w-7";

  return (
    <aside
      className="relative overflow-hidden rounded-[16px] border-2 border-[#050505] bg-[#f47a4a] p-[clamp(1rem,2.5vw,1.5rem)] shadow-[7px_7px_0_#050505] max-[860px]:mx-auto max-[860px]:w-full max-[860px]:max-w-lg"
      aria-label={label}
    >
      <div className="relative mx-auto aspect-[4/3] w-full max-w-[30rem]" role="img" aria-label={label}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 400 300"
          fill="none"
          aria-hidden="true"
        >
          <path d="M200 150L95 72" stroke="#050505" strokeWidth="3" strokeDasharray="8 8" />
          <path d="M200 150L305 72" stroke="#050505" strokeWidth="3" strokeDasharray="8 8" />
          <path d="M200 150L200 245" stroke="#050505" strokeWidth="3" strokeDasharray="8 8" />
          <circle cx="200" cy="150" r="62" stroke="#050505" strokeWidth="2" opacity="0.18" />
          <circle cx="200" cy="150" r="88" stroke="#050505" strokeWidth="2" opacity="0.1" />
        </svg>

        <div className="absolute left-1/2 top-1/2 grid h-[5.4rem] w-[5.4rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#050505] bg-white shadow-[5px_5px_0_#050505] motion-safe:animate-pulse max-[520px]:h-[4.7rem] max-[520px]:w-[4.7rem]">
          <UserGroupIcon className="h-10 w-10 text-[#050505] max-[520px]:h-9 max-[520px]:w-9" />
        </div>

        <div className={`${nodeClass} left-[12%] top-[10%] motion-safe:animate-pulse`}>
          <BriefcaseIcon className={iconClass} />
        </div>
        <div className={`${nodeClass} right-[12%] top-[10%] motion-safe:animate-pulse`}>
          <AcademicCapIcon className={iconClass} />
        </div>
        <div className={`${nodeClass} bottom-[5%] left-1/2 -translate-x-1/2 motion-safe:animate-pulse`}>
          <ChatBubbleLeftRightIcon className={iconClass} />
        </div>

        <span className="absolute left-[37%] top-[35%] h-3 w-3 rounded-full border-2 border-[#050505] bg-white motion-safe:animate-bounce" aria-hidden="true" />
        <span className="absolute right-[37%] top-[35%] h-3 w-3 rounded-full border-2 border-[#050505] bg-white motion-safe:animate-bounce" aria-hidden="true" />
        <span className="absolute bottom-[28%] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#050505] bg-white motion-safe:animate-bounce" aria-hidden="true" />
      </div>
    </aside>
  );
}

interface NonKoreanApplicantsClientProps {
  stats?: HomeStats;
}

export default function NonKoreanApplicantsClient({
  stats,
}: NonKoreanApplicantsClientProps) {
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

  const eligibilityItems = page.eligibility.items.map((item, index) => ({
    ...item,
    description:
      index === 0
        ? copy.nativeSpeakerDescription
        : index === 1
          ? copy.professionalDescription
          : item.description,
  }));

  const benefits = [copy.firstBenefit, ...page.benefits.items.slice(1, 3)];
  const processSteps = page.process.steps.map((step, index) => ({
    ...step,
    description: index === 1 ? copy.processCredentialDescription : step.description,
  }));

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
    <main className="min-h-screen overflow-hidden bg-transparent text-[#050505]">
      <div className={containerClass}>
        <section className="relative grid grid-cols-[minmax(0,1.05fr)_minmax(280px,0.75fr)] items-center gap-[clamp(1.5rem,4vw,2.5rem)] pt-[clamp(3rem,6vw,4.75rem)] pb-[clamp(2.5rem,5vw,3.75rem)] max-[860px]:grid-cols-1 max-[860px]:pt-11 max-[860px]:text-center">
          <div>
            <p className={eyebrowClass}>{copy.heroEyebrow}</p>
            <h1 className="m-0 max-w-3xl text-[clamp(2rem,4.4vw,3.7rem)] font-[950] leading-[1.05] tracking-normal text-[#050505] max-[860px]:max-w-full">
              {copy.heroTitle}
            </h1>
            <p className="mt-4 mb-0 max-w-[40rem] text-[clamp(0.98rem,1.5vw,1.08rem)] font-[590] leading-[1.65] text-[rgba(5,5,5,0.72)] max-[860px]:mx-auto">
              {copy.heroSubtitle}
            </p>
            <div className={heroActionsClass}>
              {currentUser ? (
                <Link
                  className={primaryButtonClass}
                  href="#application"
                  onClick={scrollToApplication}
                >
                  {page.hero.primaryCta}
                </Link>
              ) : (
                <Link className={primaryButtonClass} href={authHref}>
                  {page.hero.primaryCta}
                </Link>
              )}
              <Link className={secondaryButtonClass} href="/meetup">
                {page.hero.secondaryCta}
              </Link>
            </div>
          </div>

          <NetworkingAnimation label={copy.networkAnimationLabel} />
        </section>
      </div>

      <StatsSection
        stats={stats}
        title={copy.statsTitle}
        ctaHref="#application"
        onCtaClick={scrollToApplication}
      />

      <div className={containerClass}>
        <section className={sectionClass}>
          <div className={sectionHeaderClass}>
            <p className={eyebrowClass}>{page.eligibility.eyebrow}</p>
            <h2 className={sectionTitleClass}>{page.eligibility.title}</h2>
            <p className={sectionDescriptionClass}>{copy.eligibilityDescription}</p>
          </div>
          <div className="grid grid-cols-2 gap-[0.85rem] max-[760px]:grid-cols-1">
            {eligibilityItems.map((item, index) => (
              <article
                className="rounded-xl border-2 border-[#050505] bg-white p-[clamp(1rem,2.5vw,1.25rem)] shadow-[4px_4px_0_rgba(5,5,5,0.92)]"
                key={item.title}
              >
                <span className="inline-grid h-[1.9rem] w-[1.9rem] place-items-center rounded-full border-2 border-[#050505] bg-[#f47a4a] text-[0.78rem] font-[950] text-[#050505]">
                  {index + 1}
                </span>
                <h3 className="mt-[0.78rem] mb-[0.45rem] text-base font-[930] leading-[1.28] text-[#050505]">
                  {item.title}
                </h3>
                <p className="m-0 text-[0.9rem] font-[590] leading-[1.65] text-[rgba(5,5,5,0.68)]">
                  {item.description}
                </p>
                {item.countries ? (
                  <div className="mt-3 flex flex-wrap gap-[0.45rem]">
                    {item.countries.map((country) => (
                      <span
                        className="inline-flex items-center gap-[0.28rem] rounded-full border border-[rgba(5,5,5,0.18)] bg-[#fff8dc] px-2 py-[0.28rem] text-[0.72rem] font-[850] text-[#050505]"
                        key={country.name}
                      >
                        <span aria-hidden="true">{country.flag}</span>
                        <span>{country.name}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="my-[clamp(1.25rem,3vw,2rem)] rounded-2xl border-2 border-[#050505] bg-[#f47a4a] px-[clamp(1.25rem,3vw,2rem)] py-[clamp(2.5rem,5vw,3.5rem)] shadow-[6px_6px_0_#050505]">
          <div className={sectionHeaderClass}>
            <p className={eyebrowClass}>{page.benefits.eyebrow}</p>
            <h2 className={sectionTitleClass}>{page.benefits.title}</h2>
          </div>
          <div className="grid grid-cols-3 gap-[0.7rem] max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
            {benefits.map((benefit) => (
              <div
                className="rounded-[10px] border-2 border-[#050505] bg-[#fff8dc] p-[0.9rem] text-[0.88rem] font-[720] leading-[1.5] text-[#050505]"
                key={benefit}
              >
                {benefit}
              </div>
            ))}
          </div>
          <p className="mt-4 mb-0 rounded-xl border-2 border-[#050505] bg-white px-4 py-[0.95rem] text-[0.9rem] font-[820] leading-[1.55] text-[#050505] shadow-[4px_4px_0_rgba(5,5,5,0.92)]">
            {page.benefits.note}
          </p>
        </section>

        <section className={sectionClass}>
          <div className={sectionHeaderClass}>
            <p className={eyebrowClass}>{page.process.eyebrow}</p>
            <h2 className={sectionTitleClass}>{page.process.title}</h2>
            <p className={sectionDescriptionClass}>{page.process.description}</p>
          </div>
          <div className="grid gap-[0.7rem]">
            {processSteps.map((step, index) => (
              <article
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-[0.85rem] rounded-xl border border-[rgba(5,5,5,0.1)] bg-[rgba(255,255,255,0.78)] p-[0.9rem] max-[560px]:grid-cols-1 max-[560px]:text-center"
                key={step.title}
              >
                <span className="inline-grid h-[2.05rem] w-[2.05rem] place-items-center rounded-lg bg-[#050505] font-[950] text-white max-[560px]:mx-auto">
                  {index + 1}
                </span>
                <div>
                  <h3 className="mt-0 mb-[0.3rem] text-[0.94rem] font-[900] text-[#050505]">
                    {step.title}
                  </h3>
                  <p className="m-0 text-[0.88rem] font-[590] leading-[1.6] text-[rgba(5,5,5,0.66)]">
                    {step.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={sectionClass} ref={applicationRef} id="application">
          <div className="rounded-2xl border-2 border-[#050505] bg-[#fff8dc] p-[clamp(1.25rem,3vw,2rem)] shadow-[6px_6px_0_#050505]">
            <div className={sectionHeaderClass}>
              <p className={eyebrowClass}>{application.eyebrow}</p>
              <h2 className={sectionTitleClass}>{application.title}</h2>
              <p className={sectionDescriptionClass}>{application.description}</p>
            </div>

            {authLoading || loadingApplication ? null : currentUser ? (
              <form className="mt-5 grid gap-4" onSubmit={handleApply}>
                <div className="grid grid-cols-2 gap-[0.85rem] max-[640px]:grid-cols-1">
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
                </div>
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
                {applicationStatus ? (
                  <p className={formNoticeClass(true)}>{application.form.submitted}</p>
                ) : null}
                {formMessage ? (
                  <p
                    className={formNoticeClass(formMessage.tone === "success")}
                    aria-live="polite"
                  >
                    {formMessage.text}
                  </p>
                ) : null}
                <button
                  className="inline-flex min-h-[46px] w-fit cursor-pointer items-center justify-center rounded-full border-2 border-[#050505] bg-[#050505] px-[1.05rem] py-[0.66rem] text-[0.88rem] font-[900] text-white disabled:cursor-wait disabled:opacity-[0.68]"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? application.form.submitting : application.form.submit}
                </button>
              </form>
            ) : (
              <div className={heroActionsClass}>
                <Link className={primaryButtonClass} href={authHref}>
                  {application.signInCta}
                </Link>
                <p className={sectionDescriptionClass}>{application.signInHint}</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-[clamp(1.5rem,4vw,3rem)] mb-[clamp(3rem,6vw,4.5rem)] rounded-2xl border-2 border-[#050505] bg-[#050505] p-[clamp(1.65rem,4vw,2.6rem)] text-center text-white">
          <h2 className="m-0 text-[clamp(1.55rem,3.2vw,2.55rem)] font-[950] leading-[1.12] text-white">
            {page.cta.title}
          </h2>
          <p className="mx-auto mt-[0.8rem] mb-0 max-w-[42rem] text-[0.94rem] font-[590] leading-[1.7] text-[rgba(255,255,255,0.76)]">
            {page.cta.description}
          </p>
          <div className="mt-[1.3rem] flex flex-wrap justify-center gap-[0.65rem]">
            {currentUser ? (
              <Link
                className={invertedButtonClass}
                href="#application"
                onClick={scrollToApplication}
              >
                {page.cta.primary}
              </Link>
            ) : (
              <Link className={invertedButtonClass} href={authHref}>
                {page.cta.primary}
              </Link>
            )}
            <Link className={ghostButtonClass} href="/meetup">
              {page.cta.secondary}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
