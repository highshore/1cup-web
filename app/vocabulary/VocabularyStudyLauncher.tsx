"use client";

import { useRouter } from "next/navigation";
import styled from "styled-components";
import { AcademicCapIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";

const Launcher = styled.button`
  position: fixed;
  right: max(1rem, calc((100vw - 960px) / 2 + 1rem));
  bottom: 1.25rem;
  z-index: 45;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 3rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.65rem 1rem;
  font-size: 0.82rem;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 4px 4px 0 #050505;
  transition: transform 150ms ease, box-shadow 150ms ease;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 #050505;
  }

  svg { width: 19px; height: 19px; }

  @media (max-width: 640px) {
    right: 0.85rem;
    bottom: 0.9rem;
  }
`;

export default function VocabularyStudyLauncher() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { locale } = useI18n();

  if (!currentUser) return null;

  return (
    <Launcher type="button" onClick={() => router.push("/vocabulary/study")}>
      <AcademicCapIcon />
      {locale === "ko" ? "학습 시작" : "Start studying"}
    </Launcher>
  );
}
