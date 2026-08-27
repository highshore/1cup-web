"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";

import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  ShadowAdminLesson,
  ShadowDifficulty,
  loadAdminShadowLessons,
  publishShadowLesson,
  queueShadowLesson,
} from "../../lib/features/shadow/services/shadow_lesson_service";

const Wrapper = styled.main`
  display: flex;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 20px 40px;
  flex-direction: column;
  gap: 24px;
`;

const Header = styled.header`
  margin-top: 8px;
`;

const Eyebrow = styled.p`
  margin: 0 0 6px;
  color: #e0602e;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.09em;
  text-transform: uppercase;
`;

const Title = styled.h1`
  margin: 0;
  color: #050505;
  font-size: 28px;
  font-weight: 900;
`;

const Description = styled.p`
  max-width: 760px;
  margin: 8px 0 0;
  color: rgba(5, 5, 5, 0.65);
  font-weight: 600;
  line-height: 1.55;
`;

const Panel = styled.section`
  padding: 22px;
  border: 3px solid #050505;
  border-radius: 16px;
  background: #fff;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
`;

const PanelTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 18px;
  font-weight: 900;
`;

const PanelDescription = styled.p`
  max-width: 800px;
  margin: 8px 0 18px;
  color: rgba(5, 5, 5, 0.64);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
`;

const FormGrid = styled.form`
  display: grid;
  grid-template-columns: 2fr repeat(3, minmax(130px, 1fr)) auto;
  gap: 10px;
  align-items: end;

  @media (max-width: 850px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #050505;
  font-size: 12px;
  font-weight: 900;
`;

const Input = styled.input`
  min-width: 0;
  padding: 10px 11px;
  border: 1.5px solid #050505;
  border-radius: 8px;
  background: #fff;
  color: #050505;
  font: inherit;

  &:focus-visible {
    outline: 3px solid #e0602e;
    outline-offset: 2px;
  }
`;

const Select = styled.select`
  min-width: 0;
  padding: 10px 11px;
  border: 1.5px solid #050505;
  border-radius: 8px;
  background: #fff;
  color: #050505;
  font: inherit;
`;

const Button = styled.button`
  min-height: 40px;
  padding: 10px 14px;
  border: 2px solid #050505;
  border-radius: 8px;
  background: #e0602e;
  color: #050505;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  &:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }

  &:focus-visible {
    outline: 3px solid #e0602e;
    outline-offset: 3px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`;

const SecondaryButton = styled(Button)`
  background: #fff;
`;

const Notice = styled.p<{ $error?: boolean }>`
  margin: 14px 0 0;
  color: ${({ $error }) => ($error ? "#b42318" : "#176a3a")};
  font-size: 13px;
  font-weight: 800;
`;

const LessonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const LessonCard = styled.article`
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 15px;
  border: 1.5px solid #050505;
  border-radius: 10px;

  @media (max-width: 680px) {
    flex-direction: column;
  }
`;

const LessonMain = styled.div`
  min-width: 0;
`;

const LessonTitle = styled.h3`
  overflow-wrap: anywhere;
  margin: 0;
  color: #050505;
  font-size: 15px;
  font-weight: 900;
`;

const LessonUrl = styled.p`
  overflow-wrap: anywhere;
  margin: 5px 0 0;
  color: rgba(5, 5, 5, 0.55);
  font-size: 12px;
  font-weight: 600;
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 10px;
`;

const Badge = styled.span<{ $tone: "orange" | "green" | "red" | "gray" }>`
  padding: 4px 7px;
  border-radius: 999px;
  background: ${({ $tone }) =>
    $tone === "green" ? "#dff6e6" : $tone === "red" ? "#fee4e2" : $tone === "orange" ? "#ffe0d2" : "#f1f1f1"};
  color: #050505;
  font-size: 11px;
  font-weight: 900;
`;

const ErrorDetail = styled.p`
  margin: 9px 0 0;
  color: #b42318;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
`;

const Actions = styled.div`
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
`;

const Loading = styled.div`
  padding: 40px;
  color: rgba(5, 5, 5, 0.62);
  font-weight: 800;
  text-align: center;
`;

function formatDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminShadowClient() {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const { t, locale } = useI18n();
  const copy = t.admin.shadow;
  const [authorized, setAuthorized] = useState(false);
  const [lessons, setLessons] = useState<ShadowAdminLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [category, setCategory] = useState("general");
  const [difficulty, setDifficulty] = useState<ShadowDifficulty>("intermediate");
  const [captionLanguage, setCaptionLanguage] = useState("en");
  const [submitting, setSubmitting] = useState(false);
  const [actionLessonId, setActionLessonId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    if (accountStatus !== "admin") {
      router.replace("/");
      return;
    }
    setAuthorized(true);
  }, [accountStatus, authLoading, currentUser, router]);

  const load = useCallback(async () => {
    try {
      setLessons(await loadAdminShadowLessons());
    } catch (error) {
      console.error("Unable to load admin shadow lessons:", error);
      setNotice({ text: copy.loadError, error: true });
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    if (!authorized) return;
    void load();
  }, [authorized, load]);

  const hasActiveProcessing = useMemo(
    () => lessons.some((lesson) => lesson.job?.status === "queued" || lesson.job?.status === "processing"),
    [lessons],
  );

  useEffect(() => {
    if (!authorized || !hasActiveProcessing) return;
    const interval = window.setInterval(() => void load(), 4_000);
    return () => window.clearInterval(interval);
  }, [authorized, hasActiveProcessing, load]);

  const queue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);
    try {
      await queueShadowLesson({ youtubeUrl, category, difficulty, captionLanguage });
      setYoutubeUrl("");
      setNotice({ text: copy.queued });
      await load();
    } catch (error) {
      console.error("Unable to queue shadow lesson:", error);
      setNotice({ text: copy.queueError, error: true });
    } finally {
      setSubmitting(false);
    }
  };

  const retry = async (lesson: ShadowAdminLesson) => {
    setNotice(null);
    setActionLessonId(lesson.id);
    try {
      await queueShadowLesson({
        action: "retry",
        youtubeUrl: lesson.youtubeUrl,
        category: lesson.category,
        difficulty: lesson.difficulty,
        captionLanguage: "en",
      });
      setNotice({ text: copy.queued });
      await load();
    } catch (error) {
      console.error("Unable to retry shadow lesson:", error);
      setNotice({ text: copy.queueError, error: true });
    } finally {
      setActionLessonId(null);
    }
  };

  const publish = async (lessonId: string) => {
    setNotice(null);
    setActionLessonId(lessonId);
    try {
      await publishShadowLesson(lessonId);
      setNotice({ text: copy.published });
      await load();
    } catch (error) {
      console.error("Unable to publish shadow lesson:", error);
      setNotice({ text: copy.queueError, error: true });
    } finally {
      setActionLessonId(null);
    }
  };

  if (authLoading || !authorized) return <Loading>{t.admin.dashboard.loading}</Loading>;

  return (
    <Wrapper>
      <Header>
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <Title>{copy.pageTitle}</Title>
        <Description>{copy.pageDescription}</Description>
      </Header>

      <Panel>
        <PanelTitle>{copy.queueTitle}</PanelTitle>
        <PanelDescription>{copy.queueDescription}</PanelDescription>
        <FormGrid onSubmit={queue}>
          <Field>
            {copy.youtubeUrl}
            <Input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder={copy.youtubePlaceholder} required type="url" />
          </Field>
          <Field>
            {copy.category}
            <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder={copy.categoryPlaceholder} maxLength={80} />
          </Field>
          <Field>
            {copy.difficulty}
            <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value as ShadowDifficulty)}>
              <option value="novice">{copy.difficulties.novice}</option>
              <option value="intermediate">{copy.difficulties.intermediate}</option>
              <option value="advanced">{copy.difficulties.advanced}</option>
            </Select>
          </Field>
          <Field>
            {copy.captionLanguage}
            <Input value={captionLanguage} onChange={(event) => setCaptionLanguage(event.target.value)} maxLength={8} pattern="[a-z]{2,3}(-[A-Z]{2})?" required />
          </Field>
          <Button type="submit" disabled={submitting}>{submitting ? copy.queueing : copy.queue}</Button>
        </FormGrid>
        {notice ? <Notice $error={notice.error}>{notice.text}</Notice> : null}
      </Panel>

      <Panel>
        <PanelTitle>{copy.jobsTitle}</PanelTitle>
        <PanelDescription>{copy.pageDescription}</PanelDescription>
        {loading ? (
          <Loading>{copy.loading}</Loading>
        ) : lessons.length === 0 ? (
          <Loading>{copy.empty}</Loading>
        ) : (
          <LessonList>
            {lessons.map((lesson) => {
              const status = lesson.job?.status ?? lesson.publicationStatus;
              const stage = lesson.job?.stage ?? lesson.processing?.stage ?? "queued";
              const tone = status === "published" || status === "ready_for_review" ? "green" : status === "failed" ? "red" : status === "needs_audio_stt" ? "orange" : "gray";
              const formattedDate = formatDate(lesson.updatedAt, locale);
              const isActing = actionLessonId === lesson.id;
              return (
                <LessonCard key={lesson.id}>
                  <LessonMain>
                    <LessonTitle>{lesson.title}</LessonTitle>
                    <LessonUrl>{lesson.youtubeUrl}</LessonUrl>
                    <Meta>
                      <Badge $tone={tone}>{copy.status[status]}</Badge>
                      <Badge $tone="gray">{copy.stages[stage as keyof typeof copy.stages] ?? stage}</Badge>
                      <Badge $tone="gray">{lesson.job?.progress ?? lesson.processing?.progress ?? 0}%</Badge>
                      <Badge $tone="gray">{copy.difficulties[lesson.difficulty]}</Badge>
                      {formattedDate ? <Badge $tone="gray">{copy.updated.replace("{date}", formattedDate)}</Badge> : null}
                    </Meta>
                    {lesson.job?.errorMessage ? <ErrorDetail>{lesson.job.errorMessage}</ErrorDetail> : null}
                  </LessonMain>
                  <Actions>
                    {(status === "failed" || status === "needs_audio_stt") ? (
                      <SecondaryButton type="button" onClick={() => void retry(lesson)} disabled={isActing}>
                        {isActing ? copy.retrying : copy.retry}
                      </SecondaryButton>
                    ) : null}
                    {status === "ready_for_review" ? (
                      <Button type="button" onClick={() => void publish(lesson.id)} disabled={isActing}>
                        {isActing ? copy.publishing : copy.publish}
                      </Button>
                    ) : null}
                  </Actions>
                </LessonCard>
              );
            })}
          </LessonList>
        )}
      </Panel>
    </Wrapper>
  );
}
