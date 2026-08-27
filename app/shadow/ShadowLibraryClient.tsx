"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";

import { appLayout } from "../lib/constants/app_layout";
import { useI18n } from "../lib/i18n/I18nProvider";
import {
  ShadowLesson,
  loadPublishedShadowLessons,
} from "../lib/features/shadow/services/shadow_lesson_service";

const Page = styled.main`
  width: min(100%, ${appLayout.pageMaxWidth});
  margin: 0 auto;
  padding: 2.5rem ${appLayout.pageGutterDesktop} 4rem;

  @media (max-width: 640px) {
    padding-inline: ${appLayout.pageGutterMobile};
  }
`;

const Eyebrow = styled.p`
  margin: 0 0 0.55rem;
  color: #e0602e;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.11em;
  text-transform: uppercase;
`;

const Title = styled.h1`
  margin: 0;
  color: #050505;
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 950;
  letter-spacing: -0.055em;
`;

const Description = styled.p`
  max-width: 43rem;
  margin: 1rem 0 2rem;
  color: rgba(5, 5, 5, 0.65);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.7;
`;

const LessonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 1rem;
`;

const LessonCard = styled(Link)`
  display: flex;
  min-height: 180px;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.2rem;
  border: 2px solid #050505;
  border-radius: 14px;
  background: #fff;
  box-shadow: 4px 4px 0 #e0602e;
  color: #050505;
  text-decoration: none;
  transition: transform 0.16s ease, box-shadow 0.16s ease;

  &:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 #e0602e;
  }

  &:focus-visible {
    outline: 3px solid #e0602e;
    outline-offset: 4px;
  }
`;

const Category = styled.span`
  color: #e0602e;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const LessonTitle = styled.h2`
  margin: 1.1rem 0 0.65rem;
  font-size: 1.15rem;
  font-weight: 900;
  line-height: 1.35;
`;

const LessonDescription = styled.p`
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
`;

const LessonMeta = styled.div`
  margin-top: 1.1rem;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: capitalize;
`;

const State = styled.div`
  padding: 3rem 1.25rem;
  border: 2px dashed rgba(5, 5, 5, 0.3);
  border-radius: 14px;
  color: rgba(5, 5, 5, 0.62);
  font-weight: 700;
  line-height: 1.6;
  text-align: center;
`;

export default function ShadowLibraryClient() {
  const { t } = useI18n();
  const copy = t.shadow.library;
  const [lessons, setLessons] = useState<ShadowLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setLessons(await loadPublishedShadowLessons());
    } catch (error) {
      console.error("Unable to load published shadow lessons:", error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Page>
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      <Title>{copy.title}</Title>
      <Description>{copy.description}</Description>

      {loading ? (
        <State>{copy.loading}</State>
      ) : failed ? (
        <State>{copy.error}</State>
      ) : lessons.length === 0 ? (
        <State>{copy.empty}</State>
      ) : (
        <LessonGrid>
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} href={`/shadow/${encodeURIComponent(lesson.id)}`}>
              <div>
                <Category>{lesson.category}</Category>
                <LessonTitle>{lesson.title}</LessonTitle>
                {lesson.description ? <LessonDescription>{lesson.description}</LessonDescription> : null}
              </div>
              <LessonMeta>{copy.difficulty[lesson.difficulty]}</LessonMeta>
            </LessonCard>
          ))}
        </LessonGrid>
      )}
    </Page>
  );
}
