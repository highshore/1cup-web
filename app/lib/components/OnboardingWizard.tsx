"use client";

import { FormEvent, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../contexts/auth_context";
import { useI18n } from "../i18n/I18nProvider";
import { supabase } from "../supabase/client";

type Location = "anam" | "yeouido";

type OnboardingWizardProps = {
  onComplete: () => void;
};

const stepLabelClass =
  "m-0 mb-3 text-[0.76rem] font-extrabold uppercase tracking-[0.12em] text-[#a05a2c]";

const titleClass =
  "m-0 text-[clamp(1.8rem,4vw,2.55rem)] leading-[1.14] tracking-[-0.045em] text-[#22170f]";

const descriptionClass =
  "mx-0 mt-[0.9rem] mb-[1.8rem] max-w-[520px] text-[1rem] leading-[1.65] text-[#71665c]";

const fieldLabelClass =
  "mb-[0.55rem] block text-[0.85rem] font-[750] text-[#42362c]";

const inputClass =
  "box-border w-full rounded-[14px] border border-[#dcd1c3] bg-white px-[1.1rem] py-4 [font-family:inherit] text-[1rem] text-[#22170f] focus:border-[#e57732] focus:[outline:3px_solid_rgba(239,125,52,0.2)]";

const textareaClass = `${inputClass} min-h-[122px] resize-y leading-[1.55]`;

const choiceClass = (selected: boolean) =>
  `min-h-[86px] cursor-pointer rounded-2xl border p-4 text-left [font-family:inherit] text-[1rem] font-[750] text-[#2c1810] [transition:transform_160ms_ease,border-color_160ms_ease,background_160ms_ease] hover:border-[#b46936] hover:[transform:translateY(-2px)] focus-visible:outline-offset-2 focus-visible:[outline:3px_solid_rgba(239,125,52,0.35)] ${
    selected ? "border-[#2c1810] bg-[#f9eadc]" : "border-[#ded4c7] bg-white"
  }`;

const chipClass = (selected: boolean) =>
  `cursor-pointer rounded-full border px-[0.95rem] py-[0.72rem] [font-family:inherit] text-[0.9rem] font-bold [transition:all_150ms_ease] focus-visible:outline-offset-2 focus-visible:[outline:3px_solid_rgba(239,125,52,0.35)] ${
    selected
      ? "border-[#2c1810] bg-[#2c1810] text-white"
      : "border-[#ded4c7] bg-white text-[#514336]"
  }`;

const buttonClass = (primary?: boolean) =>
  `inline-flex min-h-[47px] cursor-pointer items-center justify-center gap-[0.45rem] rounded-xl border px-[1.15rem] py-3 [font-family:inherit] text-[0.92rem] font-extrabold disabled:cursor-not-allowed disabled:opacity-55 ${
    primary
      ? "border-[#2c1810] bg-[#2c1810] text-white"
      : "border-[#d7ccbd] bg-[#fffdf8] text-[#4c4035]"
  }`;

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { currentUser } = useAuth();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "");
  const [work, setWork] = useState("");
  const [location, setLocation] = useState<Location>("anam");
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [profilePublic, setProfilePublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const topicOptions = [
    { id: "speaking", label: t.onboarding.topics.speaking },
    { id: "business", label: t.onboarding.topics.business },
    { id: "culture", label: t.onboarding.topics.culture },
    { id: "news", label: t.onboarding.topics.news },
    { id: "networking", label: t.onboarding.topics.networking },
    { id: "habit", label: t.onboarding.topics.habit },
  ];

  const continueToNextStep = () => {
    setError("");
    if (step === 0 && !displayName.trim()) {
      setError(t.onboarding.errors.nameRequired);
      return;
    }
    if (step === 2 && interests.length === 0) {
      setError(t.onboarding.errors.topicRequired);
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  };

  const toggleInterest = (interest: string) => {
    setInterests((current) =>
      current.includes(interest) ? current.filter((value) => value !== interest) : [...current, interest],
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step < 3) {
      continueToNextStep();
      return;
    }
    if (!currentUser) return;

    setSaving(true);
    setError("");
    try {
      const selectedInterests = topicOptions
        .filter((topic) => interests.includes(topic.id))
        .map((topic) => topic.label)
        .join(", ");

      const { error: profileError } = await supabase
        .from("users")
        .update({
          display_name: displayName.trim(),
          work: work.trim() || null,
          location,
          interests: selectedInterests,
          bio: bio.trim() || null,
          profile_public: profilePublic,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("uid", currentUser.uid);

      if (profileError) throw profileError;

      // Keep the familiar name available when this person returns through a
      // different auth provider. This metadata is presentation-only, never authz.
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { name: displayName.trim() },
      });
      if (metadataError) console.warn("Unable to mirror onboarding name to auth metadata", metadataError.message);

      onComplete();
    } catch (submissionError) {
      console.error("Unable to save member onboarding:", submissionError);
      setError(t.onboarding.errors.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const stepContent = [
    <div key="name">
      <p className={stepLabelClass}>{t.onboarding.steps[0]}</p>
      <h2 className={titleClass}>{t.onboarding.name.title}</h2>
      <p className={descriptionClass}>{t.onboarding.name.description}</p>
      <label className={fieldLabelClass} htmlFor="onboarding-name">{t.onboarding.name.label}</label>
      <input className={inputClass} id="onboarding-name" autoFocus value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t.onboarding.name.placeholder} maxLength={60} />
    </div>,
    <div key="context">
      <p className={stepLabelClass}>{t.onboarding.steps[1]}</p>
      <h2 className={titleClass}>{t.onboarding.context.title}</h2>
      <p className={descriptionClass}>{t.onboarding.context.description}</p>
      <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
        <button type="button" className={choiceClass(location === "anam")} onClick={() => setLocation("anam")}>
          {t.onboarding.locations.anam}
          <span className="mt-[0.28rem] block text-[0.8rem] font-medium leading-[1.4] text-[#776a5d]">{t.onboarding.locations.anamDetail}</span>
        </button>
        <button type="button" className={choiceClass(location === "yeouido")} onClick={() => setLocation("yeouido")}>
          {t.onboarding.locations.yeouido}
          <span className="mt-[0.28rem] block text-[0.8rem] font-medium leading-[1.4] text-[#776a5d]">{t.onboarding.locations.yeouidoDetail}</span>
        </button>
      </div>
      <div style={{ marginTop: "1.3rem" }}>
        <label className={fieldLabelClass} htmlFor="onboarding-work">{t.onboarding.context.workLabel}</label>
        <input className={inputClass} id="onboarding-work" value={work} onChange={(event) => setWork(event.target.value)} placeholder={t.onboarding.context.workPlaceholder} maxLength={120} />
      </div>
    </div>,
    <div key="focus">
      <p className={stepLabelClass}>{t.onboarding.steps[2]}</p>
      <h2 className={titleClass}>{t.onboarding.focus.title}</h2>
      <p className={descriptionClass}>{t.onboarding.focus.description}</p>
      <div className="flex flex-wrap gap-[0.65rem]">
        {topicOptions.map((topic) => (
          <button key={topic.id} type="button" className={chipClass(interests.includes(topic.id))} onClick={() => toggleInterest(topic.id)} aria-pressed={interests.includes(topic.id)}>
            {interests.includes(topic.id) && <CheckIcon width={15} />} {topic.label}
          </button>
        ))}
      </div>
    </div>,
    <div key="story">
      <p className={stepLabelClass}>{t.onboarding.steps[3]}</p>
      <h2 className={titleClass}>{t.onboarding.story.title}</h2>
      <p className={descriptionClass}>{t.onboarding.story.description}</p>
      <label className={fieldLabelClass} htmlFor="onboarding-bio">{t.onboarding.story.label}</label>
      <textarea className={textareaClass} id="onboarding-bio" value={bio} onChange={(event) => setBio(event.target.value)} placeholder={t.onboarding.story.placeholder} maxLength={300} />
      <label className="mt-4 flex cursor-pointer items-start gap-[0.8rem] rounded-[14px] bg-[#f5efe7] p-4 text-[0.9rem] leading-[1.5] text-[#56493d]">
        <input className="mt-[0.2rem] accent-[#2c1810]" type="checkbox" checked={profilePublic} onChange={(event) => setProfilePublic(event.target.checked)} />
        <span>{t.onboarding.story.publicProfile}</span>
      </label>
    </div>,
  ];

  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center overflow-y-auto bg-[rgba(23,18,13,0.58)] p-4 backdrop-blur-[12px]" role="presentation">
      <section className="w-full max-w-[650px] overflow-hidden rounded-[28px] border border-white/55 bg-[#fffdf8] shadow-[0_28px_90px_rgba(24,14,7,0.35)]" role="dialog" aria-modal="true" aria-labelledby="member-onboarding-title">
        <div className="h-[7px] bg-[linear-gradient(90deg,#ef7d34,#f5bf45,#57855d)]" />
        <div className="p-[clamp(1.5rem,5vw,3rem)]">
          <div className="mb-8 flex items-center gap-2" aria-label={t.onboarding.progress.replace("{current}", String(step + 1)).replace("{total}", "4")}>
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={`h-[7px] flex-1 rounded-full [transition:background_180ms_ease] ${
                  index === step || index < step ? "bg-[#2c1810]" : "bg-[#e6ded3]"
                }`}
              />
            ))}
          </div>
          <form onSubmit={submit}>
            <div id="member-onboarding-title">{stepContent[step]}</div>
            {error && <p className="mx-0 mt-4 mb-0 text-[0.87rem] text-[#b42318]" role="alert">{error}</p>}
            <div className="mt-9 flex justify-between gap-3">
              {step > 0 ? <button type="button" className={buttonClass()} onClick={() => { setError(""); setStep((current) => current - 1); }} disabled={saving}><ArrowLeftIcon width={17} /> {t.onboarding.back}</button> : <span />}
              {step < 3 ? <button type="button" className={buttonClass(true)} onClick={continueToNextStep}>{t.onboarding.next} <ArrowRightIcon width={17} /></button> : <button type="submit" className={buttonClass(true)} disabled={saving}>{saving ? t.onboarding.saving : <><SparklesIcon width={17} /> {t.onboarding.finish}</>}</button>}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
