"use client";

import { FormEvent, useState } from "react";
import styled from "styled-components";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../contexts/auth_context";
import { useI18n } from "../i18n/I18nProvider";
import { supabase } from "../supabase/client";

type Location = "anam" | "yeouido";

type OnboardingWizardProps = {
  onComplete: () => void;
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 1rem;
  overflow-y: auto;
  background: rgba(23, 18, 13, 0.58);
  backdrop-filter: blur(12px);
`;

const Dialog = styled.section`
  width: min(100%, 650px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 28px;
  background: #fffdf8;
  box-shadow: 0 28px 90px rgba(24, 14, 7, 0.35);
`;

const Accent = styled.div`
  height: 7px;
  background: linear-gradient(90deg, #ef7d34, #f5bf45, #57855d);
`;

const Content = styled.div`
  padding: clamp(1.5rem, 5vw, 3rem);
`;

const Progress = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
`;

const ProgressDot = styled.span<{ $active: boolean; $complete: boolean }>`
  height: 7px;
  flex: 1;
  border-radius: 999px;
  background: ${({ $active, $complete }) => ($active || $complete ? "#2c1810" : "#e6ded3")};
  transition: background 180ms ease;
`;

const StepLabel = styled.p`
  margin: 0 0 0.75rem;
  color: #a05a2c;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const Title = styled.h2`
  margin: 0;
  color: #22170f;
  font-size: clamp(1.8rem, 4vw, 2.55rem);
  line-height: 1.14;
  letter-spacing: -0.045em;
`;

const Description = styled.p`
  max-width: 520px;
  margin: 0.9rem 0 1.8rem;
  color: #71665c;
  font-size: 1rem;
  line-height: 1.65;
`;

const FieldLabel = styled.label`
  display: block;
  margin-bottom: 0.55rem;
  color: #42362c;
  font-size: 0.85rem;
  font-weight: 750;
`;

const Input = styled.input`
  box-sizing: border-box;
  width: 100%;
  padding: 1rem 1.1rem;
  border: 1px solid #dcd1c3;
  border-radius: 14px;
  background: #fff;
  color: #22170f;
  font: inherit;
  font-size: 1rem;

  &:focus {
    outline: 3px solid rgba(239, 125, 52, 0.2);
    border-color: #e57732;
  }
`;

const Textarea = styled.textarea`
  box-sizing: border-box;
  width: 100%;
  min-height: 122px;
  resize: vertical;
  padding: 1rem 1.1rem;
  border: 1px solid #dcd1c3;
  border-radius: 14px;
  background: #fff;
  color: #22170f;
  font: inherit;
  font-size: 1rem;
  line-height: 1.55;

  &:focus {
    outline: 3px solid rgba(239, 125, 52, 0.2);
    border-color: #e57732;
  }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const Choice = styled.button<{ $selected: boolean }>`
  min-height: 86px;
  padding: 1rem;
  border: 1px solid ${({ $selected }) => ($selected ? "#2c1810" : "#ded4c7")};
  border-radius: 16px;
  background: ${({ $selected }) => ($selected ? "#f9eadc" : "#fff")};
  color: #2c1810;
  cursor: pointer;
  font: inherit;
  font-weight: 750;
  text-align: left;
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;

  &:hover { transform: translateY(-2px); border-color: #b46936; }
  &:focus-visible { outline: 3px solid rgba(239, 125, 52, 0.35); outline-offset: 2px; }
`;

const ChoiceDetail = styled.span`
  display: block;
  margin-top: 0.28rem;
  color: #776a5d;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.4;
`;

const ChipList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
`;

const Chip = styled.button<{ $selected: boolean }>`
  padding: 0.72rem 0.95rem;
  border: 1px solid ${({ $selected }) => ($selected ? "#2c1810" : "#ded4c7")};
  border-radius: 999px;
  background: ${({ $selected }) => ($selected ? "#2c1810" : "#fff")};
  color: ${({ $selected }) => ($selected ? "#fff" : "#514336")};
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  transition: all 150ms ease;

  &:focus-visible { outline: 3px solid rgba(239, 125, 52, 0.35); outline-offset: 2px; }
`;

const PrivacyCard = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 14px;
  background: #f5efe7;
  color: #56493d;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1.5;

  input { margin-top: 0.2rem; accent-color: #2c1810; }
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 2.25rem;
`;

const Button = styled.button<{ $primary?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 47px;
  padding: 0.75rem 1.15rem;
  border: ${({ $primary }) => ($primary ? "1px solid #2c1810" : "1px solid #d7ccbd")};
  border-radius: 12px;
  background: ${({ $primary }) => ($primary ? "#2c1810" : "#fffdf8")};
  color: ${({ $primary }) => ($primary ? "#fff" : "#4c4035")};
  cursor: pointer;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 800;

  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

const ErrorText = styled.p`
  margin: 1rem 0 0;
  color: #b42318;
  font-size: 0.87rem;
`;

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
      <StepLabel>{t.onboarding.steps[0]}</StepLabel>
      <Title>{t.onboarding.name.title}</Title>
      <Description>{t.onboarding.name.description}</Description>
      <FieldLabel htmlFor="onboarding-name">{t.onboarding.name.label}</FieldLabel>
      <Input id="onboarding-name" autoFocus value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t.onboarding.name.placeholder} maxLength={60} />
    </div>,
    <div key="context">
      <StepLabel>{t.onboarding.steps[1]}</StepLabel>
      <Title>{t.onboarding.context.title}</Title>
      <Description>{t.onboarding.context.description}</Description>
      <CardGrid>
        <Choice type="button" $selected={location === "anam"} onClick={() => setLocation("anam")}>
          {t.onboarding.locations.anam}<ChoiceDetail>{t.onboarding.locations.anamDetail}</ChoiceDetail>
        </Choice>
        <Choice type="button" $selected={location === "yeouido"} onClick={() => setLocation("yeouido")}>
          {t.onboarding.locations.yeouido}<ChoiceDetail>{t.onboarding.locations.yeouidoDetail}</ChoiceDetail>
        </Choice>
      </CardGrid>
      <div style={{ marginTop: "1.3rem" }}>
        <FieldLabel htmlFor="onboarding-work">{t.onboarding.context.workLabel}</FieldLabel>
        <Input id="onboarding-work" value={work} onChange={(event) => setWork(event.target.value)} placeholder={t.onboarding.context.workPlaceholder} maxLength={120} />
      </div>
    </div>,
    <div key="focus">
      <StepLabel>{t.onboarding.steps[2]}</StepLabel>
      <Title>{t.onboarding.focus.title}</Title>
      <Description>{t.onboarding.focus.description}</Description>
      <ChipList>
        {topicOptions.map((topic) => (
          <Chip key={topic.id} type="button" $selected={interests.includes(topic.id)} onClick={() => toggleInterest(topic.id)} aria-pressed={interests.includes(topic.id)}>
            {interests.includes(topic.id) && <CheckIcon width={15} />} {topic.label}
          </Chip>
        ))}
      </ChipList>
    </div>,
    <div key="story">
      <StepLabel>{t.onboarding.steps[3]}</StepLabel>
      <Title>{t.onboarding.story.title}</Title>
      <Description>{t.onboarding.story.description}</Description>
      <FieldLabel htmlFor="onboarding-bio">{t.onboarding.story.label}</FieldLabel>
      <Textarea id="onboarding-bio" value={bio} onChange={(event) => setBio(event.target.value)} placeholder={t.onboarding.story.placeholder} maxLength={300} />
      <PrivacyCard>
        <input type="checkbox" checked={profilePublic} onChange={(event) => setProfilePublic(event.target.checked)} />
        <span>{t.onboarding.story.publicProfile}</span>
      </PrivacyCard>
    </div>,
  ];

  return (
    <Overlay role="presentation">
      <Dialog role="dialog" aria-modal="true" aria-labelledby="member-onboarding-title">
        <Accent />
        <Content>
          <Progress aria-label={t.onboarding.progress.replace("{current}", String(step + 1)).replace("{total}", "4")}>
            {[0, 1, 2, 3].map((index) => <ProgressDot key={index} $active={index === step} $complete={index < step} />)}
          </Progress>
          <form onSubmit={submit}>
            <div id="member-onboarding-title">{stepContent[step]}</div>
            {error && <ErrorText role="alert">{error}</ErrorText>}
            <Footer>
              {step > 0 ? <Button type="button" onClick={() => { setError(""); setStep((current) => current - 1); }} disabled={saving}><ArrowLeftIcon width={17} /> {t.onboarding.back}</Button> : <span />}
              {step < 3 ? <Button $primary type="button" onClick={continueToNextStep}>{t.onboarding.next} <ArrowRightIcon width={17} /></Button> : <Button $primary type="submit" disabled={saving}>{saving ? t.onboarding.saving : <><SparklesIcon width={17} /> {t.onboarding.finish}</>}</Button>}
            </Footer>
          </form>
        </Content>
      </Dialog>
    </Overlay>
  );
}
