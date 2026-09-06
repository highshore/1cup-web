"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
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

interface NonKoreanApplicantsClientProps {
  stats?: HomeStats;
}

export default function NonKoreanApplicantsClient({
  stats,
}: NonKoreanApplicantsClientProps) {
  const { t } = useI18n();
  const { currentUser, isLoading: authLoading } = useAuth();
  const applicationRef = useRef<HTMLElement | null>(null);
  const [email, setEmail] = useState("");
  const [nationality, setNationality] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const page = t.nonKoreanApplicants;
  const application = page.application;
  const authHref = "/auth?redirect=%2Fnon-korean-applicants%23application";

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
        setLinkedinUrl(data?.linkedin_url ?? "");
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
    const normalizedLinkedinUrl = linkedinUrl.trim();

    let isLinkedInProfile = false;
    try {
      const parsedUrl = new URL(normalizedLinkedinUrl);
      isLinkedInProfile =
        parsedUrl.protocol === "https:" &&
        (parsedUrl.hostname === "linkedin.com" || parsedUrl.hostname.endsWith(".linkedin.com"));
    } catch {
      isLinkedInProfile = false;
    }

    if (!isLinkedInProfile) {
      setFormMessage({ tone: "error", text: application.form.invalidLinkedIn });
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
            linkedin_url: normalizedLinkedinUrl,
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
            <p className={eyebrowClass}>{page.hero.eyebrow}</p>
            <h1 className="m-0 max-w-3xl text-[clamp(2rem,4.4vw,3.7rem)] font-[950] leading-[1.05] tracking-normal text-[#050505] max-[860px]:max-w-full">
              {page.hero.title}
            </h1>
            <p className="mt-4 mb-0 max-w-[40rem] text-[clamp(0.98rem,1.5vw,1.08rem)] font-[590] leading-[1.65] text-[rgba(5,5,5,0.72)] max-[860px]:mx-auto">
              {page.hero.subtitle}
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

          <aside
            className="relative rounded-[14px] border-2 border-[#050505] bg-[#f47a4a] p-[clamp(1.05rem,2.5vw,1.4rem)] text-left shadow-[7px_7px_0_#050505] max-[860px]:mx-auto max-[860px]:max-w-lg"
            aria-label={page.hero.cardTitle}
          >
            <h2 className="mb-4 text-base font-[950] leading-[1.25] text-[#050505]">
              {page.hero.cardTitle}
            </h2>
            <ul className="m-0 grid list-none gap-[0.58rem] p-0">
              {page.hero.points.map((point) => (
                <li
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-[0.55rem] text-[0.9rem] font-[690] leading-[1.45] text-[rgba(5,5,5,0.82)]"
                  key={point}
                >
                  <span
                    className="mt-[0.42rem] h-[0.58rem] w-[0.58rem] rounded-full border-2 border-[#050505] bg-[#fff8dc]"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </aside>
        </section>
      </div>

      <StatsSection stats={stats} />

      <div className={containerClass}>
        <section className={sectionClass}>
          <div className={sectionHeaderClass}>
            <p className={eyebrowClass}>{page.eligibility.eyebrow}</p>
            <h2 className={sectionTitleClass}>{page.eligibility.title}</h2>
            <p className={sectionDescriptionClass}>{page.eligibility.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-[0.85rem] max-[760px]:grid-cols-1">
            {page.eligibility.items.map((item, index) => (
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
      </div>

      <section className="my-[clamp(1.25rem,3vw,2rem)] border-y-2 border-[#050505] bg-[#f47a4a] py-[clamp(2.5rem,5vw,3.5rem)]">
        <div className={containerClass}>
          <div className={sectionHeaderClass}>
            <p className={eyebrowClass}>{page.benefits.eyebrow}</p>
            <h2 className={sectionTitleClass}>{page.benefits.title}</h2>
          </div>
          <div className="grid grid-cols-4 gap-[0.7rem] max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
            {page.benefits.items.map((benefit) => (
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
        </div>
      </section>

      <div className={containerClass}>
        <section className={sectionClass}>
          <div className={sectionHeaderClass}>
            <p className={eyebrowClass}>{page.process.eyebrow}</p>
            <h2 className={sectionTitleClass}>{page.process.title}</h2>
            <p className={sectionDescriptionClass}>{page.process.description}</p>
          </div>
          <div className="grid gap-[0.7rem]">
            {page.process.steps.map((step, index) => (
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
                  {application.form.linkedinLabel}
                  <input
                    className={formInputClass}
                    type="url"
                    autoComplete="url"
                    value={linkedinUrl}
                    onChange={(event) => setLinkedinUrl(event.target.value)}
                    placeholder={application.form.linkedinPlaceholder}
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
