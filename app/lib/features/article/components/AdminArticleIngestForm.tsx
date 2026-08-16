"use client";

import React, {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { httpsCallable } from "firebase/functions";
import styled from "styled-components";

import { functions } from "../../../firebase/firebase";
import { useI18n } from "../../../i18n/I18nProvider";
import {
  uploadArticleImage,
  validateArticleImageFiles,
} from "../services/article_image_service";

const MAX_PHOTOS = 6;

type CreateAdminArticleResponse = {
  articleId: string;
};

type SelectedPhoto = {
  id: string;
  file: File;
};

interface AdminArticleIngestFormProps {
  onArticleQueued?: (article: { articleId: string; title: string }) => void | Promise<void>;
  onArticleCreated?: () => void | Promise<void>;
}

const FormSection = styled.section`
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
  border: 3px solid #050505;
  margin-bottom: 30px;
`;

const FormTitle = styled.h2`
  display: inline-flex;
  align-items: center;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.3rem 0.7rem;
  font-size: 16px;
  font-weight: 900;
  margin: 0 0 10px;
`;

const Description = styled.p`
  margin: 0 0 20px;
  color: rgba(5, 5, 5, 0.66);
  font-size: 14px;
  line-height: 1.55;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label<{ $full?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 7px;
  grid-column: ${({ $full }) => ($full ? "1 / -1" : "auto")};
  color: #050505;
  font-size: 13px;
  font-weight: 800;
`;

const FieldHint = styled.span`
  color: rgba(5, 5, 5, 0.57);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
`;

const TextInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 2px solid #050505;
  border-radius: 10px;
  padding: 11px 12px;
  background: #ffffff;
  color: #050505;
  font: inherit;
  font-size: 14px;

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 250px;
  box-sizing: border-box;
  resize: vertical;
  border: 2px solid #050505;
  border-radius: 10px;
  padding: 12px;
  background: #ffffff;
  color: #050505;
  font: inherit;
  font-size: 14px;
  line-height: 1.55;

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const PhotoPicker = styled.button`
  width: fit-content;
  border: 2px dashed #050505;
  border-radius: 10px;
  padding: 11px 14px;
  background: #fff8f4;
  color: #050505;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;

  &:hover,
  &:focus-visible {
    background: #ffe5d7;
  }

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const PhotoList = styled.ol`
  list-style: none;
  padding: 0;
  margin: 4px 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 10px;
`;

const PhotoCard = styled.li`
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  border: 1.5px solid #050505;
  border-radius: 10px;
  background: #ffffff;
  padding: 8px;
`;

const PhotoThumbnail = styled.img`
  width: 56px;
  height: 56px;
  object-fit: cover;
  border: 1.5px solid #050505;
  border-radius: 7px;
  background: #fff8f4;
`;

const PhotoDetails = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const PhotoName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #050505;
  font-size: 12px;
  font-weight: 800;
`;

const PhotoPosition = styled.span`
  color: rgba(5, 5, 5, 0.58);
  font-size: 11px;
  font-weight: 700;
`;

const PhotoControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const PhotoControl = styled.button<{ $danger?: boolean }>`
  border: 1.5px solid #050505;
  border-radius: 6px;
  padding: 3px 6px;
  background: ${({ $danger }) => ($danger ? "#fee2e2" : "#ffffff")};
  color: ${({ $danger }) => ($danger ? "#991b1b" : "#050505")};
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 900;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`;

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
`;

const SubmitButton = styled.button`
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 3px 3px 0 #050505;
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  &:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #050505;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.62;
    box-shadow: none;
  }
`;

const StatusMessage = styled.p<{ $tone: "error" | "success" }>`
  margin: 0;
  color: ${({ $tone }) => ($tone === "error" ? "#991b1b" : "#166534")};
  font-size: 13px;
  font-weight: 800;
`;

const photoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function PhotoPreview({
  photo,
  index,
  total,
  disabled,
  positionLabel,
  moveEarlierLabel,
  moveLaterLabel,
  removeLabel,
  onMove,
  onRemove,
}: {
  photo: SelectedPhoto;
  index: number;
  total: number;
  disabled: boolean;
  positionLabel: string;
  moveEarlierLabel: string;
  moveLaterLabel: string;
  removeLabel: string;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const nextUrl = URL.createObjectURL(photo.file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [photo.file]);

  return (
    <PhotoCard>
      <PhotoThumbnail src={previewUrl} alt="" />
      <PhotoDetails>
        <PhotoName title={photo.file.name}>{photo.file.name}</PhotoName>
        <PhotoPosition>{positionLabel}</PhotoPosition>
        <PhotoControls>
          <PhotoControl
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={disabled || index === 0}
            aria-label={moveEarlierLabel}
          >
            ←
          </PhotoControl>
          <PhotoControl
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={disabled || index === total - 1}
            aria-label={moveLaterLabel}
          >
            →
          </PhotoControl>
          <PhotoControl
            type="button"
            $danger
            onClick={() => onRemove(photo.id)}
            disabled={disabled}
          >
            {removeLabel}
          </PhotoControl>
        </PhotoControls>
      </PhotoDetails>
    </PhotoCard>
  );
}

export default function AdminArticleIngestForm({
  onArticleQueued,
  onArticleCreated,
}: AdminArticleIngestFormProps) {
  const { t } = useI18n();
  const copy = t.admin.articleIngest;
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQueued, setIsQueued] = useState(false);

  const addPhotos = (files: File[]) => {
    if (!files.length) return;

    const { valid } = validateArticleImageFiles(files);
    if (valid.length !== files.length || valid.length + photos.length > MAX_PHOTOS) {
      setError(copy.invalidPhotos);
      return;
    }

    setPhotos((current) => [
      ...current,
      ...valid.map((file) => ({ id: photoId(), file })),
    ]);
    setError(null);
    setIsQueued(false);
  };

  const handlePhotos = (event: ChangeEvent<HTMLInputElement>) => {
    addPhotos(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const handlePhotoPaste = (event: React.ClipboardEvent<HTMLFormElement>) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item, index) => {
        const blob = item.getAsFile();
        if (!blob) return null;
        const extension = blob.type.split("/")[1] || "png";
        return new File([blob], "pasted-photo-" + (index + 1) + "." + extension, {
          type: blob.type,
        });
      })
      .filter((file): file is File => Boolean(file));

    if (!imageFiles.length) return;

    event.preventDefault();
    addPhotos(imageFiles);
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= photos.length) return;

    setPhotos((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    setIsQueued(false);
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    setIsQueued(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsQueued(false);

    if (!title.trim() || !sourceUrl.trim() || !body.trim()) {
      setError(copy.requiredFields);
      return;
    }

    const submittedTitle = title.trim();
    setIsProcessing(true);

    try {
      const imageUrls = await Promise.all(
        photos.map((photo) => uploadArticleImage(photo.file))
      );
      const createArticle = httpsCallable<
        { title: string; sourceUrl: string; body: string; imageUrls: string[] },
        CreateAdminArticleResponse
      >(functions, "createAdminArticle");
      const response = await createArticle({
        title: submittedTitle,
        sourceUrl: sourceUrl.trim(),
        body: body.trim(),
        imageUrls,
      });

      await onArticleQueued?.({
        articleId: response.data.articleId,
        title: submittedTitle,
      });
      setTitle("");
      setSourceUrl("");
      setBody("");
      setPhotos([]);
      setIsQueued(true);
      if (photoInputRef.current) photoInputRef.current.value = "";
      await onArticleCreated?.();
    } catch (processingError) {
      console.error("Unable to queue admin article:", processingError);
      setError(copy.processingError);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <FormSection>
      <FormTitle>{copy.title}</FormTitle>
      <Description>{copy.description}</Description>
      <form onSubmit={handleSubmit} onPaste={handlePhotoPaste}>
        <FormGrid>
          <Field>
            {copy.titleLabel}
            <TextInput
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setIsQueued(false);
              }}
              placeholder={copy.titlePlaceholder}
              maxLength={240}
              required
            />
          </Field>

          <Field>
            {copy.sourceUrlLabel}
            <TextInput
              type="url"
              value={sourceUrl}
              onChange={(event) => {
                setSourceUrl(event.target.value);
                setIsQueued(false);
              }}
              placeholder={copy.sourceUrlPlaceholder}
              maxLength={2_000}
              required
            />
          </Field>

          <Field $full>
            {copy.bodyLabel}
            <TextArea
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setIsQueued(false);
              }}
              placeholder={copy.bodyPlaceholder}
              maxLength={30_000}
              required
            />
            <FieldHint>{copy.bodyHint}</FieldHint>
          </Field>

          <Field as="div" $full>
            {copy.photosLabel}
            <HiddenFileInput
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handlePhotos}
            />
            <PhotoPicker
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isProcessing}
            >
              {copy.choosePhotos}
            </PhotoPicker>
            <FieldHint>{copy.photosHint}</FieldHint>
            <FieldHint>{copy.photosPasteHint}</FieldHint>
            {photos.length > 0 && (
              <PhotoList aria-label={copy.selectedPhotos.replace("{count}", String(photos.length))}>
                {photos.map((photo, index) => (
                  <PhotoPreview
                    key={photo.id}
                    photo={photo}
                    index={index}
                    total={photos.length}
                    disabled={isProcessing}
                    positionLabel={copy.photoPosition.replace(
                      "{position}",
                      String(index + 1)
                    )}
                    moveEarlierLabel={copy.movePhotoEarlier}
                    moveLaterLabel={copy.movePhotoLater}
                    removeLabel={copy.removePhoto}
                    onMove={movePhoto}
                    onRemove={removePhoto}
                  />
                ))}
              </PhotoList>
            )}
          </Field>
        </FormGrid>

        <ActionRow>
          <SubmitButton type="submit" disabled={isProcessing}>
            {isProcessing ? copy.queueing : copy.submit}
          </SubmitButton>
          {error && <StatusMessage $tone="error">{error}</StatusMessage>}
          {isQueued && <StatusMessage $tone="success">{copy.queued}</StatusMessage>}
        </ActionRow>
      </form>
    </FormSection>
  );
}
