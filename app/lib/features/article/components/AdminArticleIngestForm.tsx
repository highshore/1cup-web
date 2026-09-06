"use client";

import React, {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { invokeFunction } from "../../../supabase/client";
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

const fieldClasses = (full?: boolean) =>
  `flex flex-col gap-[7px] ${full ? "col-[1/-1]" : "col-[auto]"} text-[#050505] text-[13px] font-extrabold`;

function Field({
  $full,
  as,
  children,
}: {
  $full?: boolean;
  as?: "div";
  children?: React.ReactNode;
}) {
  if (as === "div") {
    return <div className={fieldClasses($full)}>{children}</div>;
  }
  return <label className={fieldClasses($full)}>{children}</label>;
}

function FieldHint({ children }: { children?: React.ReactNode }) {
  return (
    <span className="text-[rgba(5,5,5,0.57)] text-[12px] font-semibold leading-[1.45]">
      {children}
    </span>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full box-border border-2 border-[#050505] rounded-[10px] py-[11px] px-3 bg-white text-[#050505] [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-weight:inherit] [line-height:inherit] text-[14px] focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-2"
      {...props}
    />
  );
}

function PhotoControl({
  $danger,
  children,
  ...rest
}: { $danger?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`border-[1.5px] border-[#050505] rounded-md py-[3px] px-[6px] ${
        $danger ? "bg-[#fee2e2] text-[#991b1b]" : "bg-white text-[#050505]"
      } cursor-pointer [font-family:inherit] [font-style:inherit] [font-variant:inherit] [line-height:inherit] text-[11px] font-black disabled:cursor-not-allowed disabled:opacity-45`}
      {...rest}
    >
      {children}
    </button>
  );
}

function StatusMessage({
  $tone,
  children,
}: {
  $tone: "error" | "success";
  children?: React.ReactNode;
}) {
  return (
    <p
      className={`m-0 ${
        $tone === "error" ? "text-[#991b1b]" : "text-[#166534]"
      } text-[13px] font-extrabold`}
    >
      {children}
    </p>
  );
}

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
    <li className="grid grid-cols-[56px_minmax(0,1fr)] gap-[10px] items-center border-[1.5px] border-[#050505] rounded-[10px] bg-white p-2">
      <img
        className="w-14 h-14 object-cover border-[1.5px] border-[#050505] rounded-[7px] bg-[#fff8f4]"
        src={previewUrl}
        alt=""
      />
      <div className="min-w-0 flex flex-col gap-[5px]">
        <span
          className="overflow-hidden text-ellipsis whitespace-nowrap text-[#050505] text-[12px] font-extrabold"
          title={photo.file.name}
        >
          {photo.file.name}
        </span>
        <span className="text-[rgba(5,5,5,0.58)] text-[11px] font-bold">
          {positionLabel}
        </span>
        <div className="flex flex-wrap gap-[5px]">
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
        </div>
      </div>
    </li>
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
      const response = await invokeFunction<CreateAdminArticleResponse>(
        "admin-article",
        {
          action: "create",
          title: submittedTitle,
          sourceUrl: sourceUrl.trim(),
          body: body.trim(),
          imageUrls,
        },
      );

      await onArticleQueued?.({
        articleId: response.articleId,
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
    <section className="bg-white rounded-2xl p-6 shadow-[6px_6px_0_rgba(5,5,5,0.9)] border-[3px] border-[#050505] mb-[30px]">
      <h2 className="inline-flex items-center border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] py-[0.3rem] px-[0.7rem] text-[16px] font-black m-0 mb-[10px]">
        {copy.title}
      </h2>
      <p className="m-0 mb-5 text-[rgba(5,5,5,0.66)] text-[14px] leading-[1.55]">
        {copy.description}
      </p>
      <form onSubmit={handleSubmit} onPaste={handlePhotoPaste}>
        <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
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
            <textarea
              className="w-full min-h-[250px] box-border resize-y border-2 border-[#050505] rounded-[10px] p-3 bg-white text-[#050505] [font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-weight:inherit] text-[14px] leading-[1.55] focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-2"
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
            <input
              className="hidden"
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handlePhotos}
            />
            <button
              className="w-fit border-2 border-dashed border-[#050505] rounded-[10px] py-[11px] px-[14px] bg-[#fff8f4] text-[#050505] cursor-pointer [font-family:inherit] [font-style:inherit] [font-variant:inherit] [line-height:inherit] text-[13px] font-black hover:bg-[#ffe5d7] focus-visible:bg-[#ffe5d7] focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-2"
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isProcessing}
            >
              {copy.choosePhotos}
            </button>
            <FieldHint>{copy.photosHint}</FieldHint>
            <FieldHint>{copy.photosPasteHint}</FieldHint>
            {photos.length > 0 && (
              <ol
                className="list-none p-0 m-0 mt-1 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-[10px]"
                aria-label={copy.selectedPhotos.replace("{count}", String(photos.length))}
              >
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
              </ol>
            )}
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button
            className="border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] py-3 px-[18px] text-[14px] font-black cursor-pointer shadow-[3px_3px_0_#050505] [transition:transform_0.14s_ease,box-shadow_0.14s_ease] enabled:hover:[transform:translate(-1px,-1px)] enabled:hover:shadow-[4px_4px_0_#050505] disabled:cursor-wait disabled:opacity-[0.62] disabled:shadow-none"
            type="submit"
            disabled={isProcessing}
          >
            {isProcessing ? copy.queueing : copy.submit}
          </button>
          {error && <StatusMessage $tone="error">{error}</StatusMessage>}
          {isQueued && <StatusMessage $tone="success">{copy.queued}</StatusMessage>}
        </div>
      </form>
    </section>
  );
}
