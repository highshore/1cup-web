"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styled from "styled-components";
import { useI18n } from "../i18n/I18nProvider";

const PROMPT_SESSION_KEY = "nonKoreanApplicantPromptSeen";

const Backdrop = styled.div`
  position: fixed;
  z-index: 90;
  inset: 0;
  display: grid;
  place-items: end center;
  padding: 1rem;
  background: rgba(5, 5, 5, 0.38);
`;

const Dialog = styled.section`
  position: relative;
  width: min(100%, 28rem);
  border: 2px solid #050505;
  border-radius: 14px;
  background: #fff8dc;
  padding: 1.25rem;
  box-shadow: 6px 6px 0 #050505;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #050505;
  cursor: pointer;
  font-size: 1.35rem;
  line-height: 1;

  &:hover,
  &:focus-visible {
    background: rgba(5, 5, 5, 0.08);
  }
`;

const Title = styled.h2`
  max-width: 20rem;
  margin: 0;
  color: #050505;
  font-size: 1.35rem;
  font-weight: 950;
  line-height: 1.2;
`;

const Description = styled.p`
  margin: 0.7rem 0 0;
  color: rgba(5, 5, 5, 0.7);
  font-size: 0.9rem;
  font-weight: 620;
  line-height: 1.55;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 1rem;
`;

const PrimaryAction = styled(Link)`
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #050505;
  color: #ffffff;
  padding: 0.55rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 900;
  text-decoration: none;

  &:hover {
    color: #ffffff;
    text-decoration: none;
  }
`;

const SecondaryAction = styled.button`
  min-height: 42px;
  border: 2px solid #050505;
  border-radius: 999px;
  background: transparent;
  color: #050505;
  padding: 0.55rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 850;
  cursor: pointer;
`;

export default function NonKoreanApplicantPrompt() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isExcludedRoute =
    pathname === "/non-korean-applicants" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/payment");

  useEffect(() => {
    if (locale !== "en" || isExcludedRoute) {
      setOpen(false);
      return;
    }

    if (sessionStorage.getItem(PROMPT_SESSION_KEY)) return;

    const timer = window.setTimeout(() => {
      sessionStorage.setItem(PROMPT_SESSION_KEY, "true");
      setOpen(true);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [isExcludedRoute, locale, pathname]);

  if (!open) return null;

  const copy = t.nonKoreanApplicants.popup;
  const dismiss = () => setOpen(false);

  return (
    <Backdrop role="presentation" onMouseDown={dismiss}>
      <Dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="non-korean-applicant-prompt-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <CloseButton type="button" onClick={dismiss} aria-label={copy.close}>
          ×
        </CloseButton>
        <Title id="non-korean-applicant-prompt-title">{copy.title}</Title>
        <Description>{copy.description}</Description>
        <Actions>
          <PrimaryAction href="/non-korean-applicants" onClick={dismiss}>
            {copy.primary}
          </PrimaryAction>
          <SecondaryAction type="button" onClick={dismiss}>
            {copy.dismiss}
          </SecondaryAction>
        </Actions>
      </Dialog>
    </Backdrop>
  );
}
