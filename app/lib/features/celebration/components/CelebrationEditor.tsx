"use client";

import React, { useRef, useState } from "react";

import { Celebration } from "../types/celebration_types";
import { uploadCelebrationImage } from "../services/celebration_image_service";

interface CelebrationEditorProps {
  celebration: Celebration | null;
  onSave: (data: Partial<Celebration>) => Promise<void> | void;
  onClose: () => void;
  onDelete?: (id: string) => Promise<void> | void;
}

const fieldClass =
  "flex flex-col gap-[0.35rem] text-[0.85rem] font-extrabold text-[#050505]";

const inputClass =
  "w-full rounded-[10px] border-2 border-[#050505] bg-white px-[0.7rem] py-[0.6rem] [font-family:inherit] text-[0.92rem] font-semibold text-[#050505] focus:outline-none focus:shadow-[2px_2px_0_#f47a4a]";

const smallButtonClass = (variant?: "ghost" | "danger") =>
  `cursor-pointer rounded-full border-2 border-[#050505] px-[0.85rem] py-[0.4rem] [font-family:inherit] text-[0.82rem] font-extrabold disabled:cursor-not-allowed disabled:opacity-50 ${
    variant === "danger" ? "bg-[#fee2e2] text-[#991b1b]" : "bg-white text-[#050505]"
  }`;

// Convert an ISO string to the yyyy-MM-dd value an <input type="date"> expects.
const toDateInputValue = (iso?: string | null): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const CelebrationEditor: React.FC<CelebrationEditorProps> = ({
  celebration,
  onSave,
  onClose,
  onDelete,
}) => {
  const isEditing = Boolean(celebration);
  const [memberName, setMemberName] = useState(celebration?.memberName || "");
  const [headline, setHeadline] = useState(celebration?.headline || "");
  const [description, setDescription] = useState(
    celebration?.description || ""
  );
  const [achievedAt, setAchievedAt] = useState(
    toDateInputValue(celebration?.achievedAt)
  );
  const [logoUrl, setLogoUrl] = useState(celebration?.logoUrl || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadCelebrationImage(file);
      setLogoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!memberName.trim() || !headline.trim()) {
      setError("멤버 이름과 헤드라인은 필수입니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        memberName: memberName.trim(),
        headline: headline.trim(),
        description: description.trim(),
        logoUrl: logoUrl || "",
        achievedAt: achievedAt ? new Date(achievedAt).toISOString() : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!celebration || !onDelete) return;
    if (!window.confirm("이 축하 항목을 삭제하시겠습니까?")) return;
    setSaving(true);
    try {
      await onDelete(celebration.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-[rgba(5,5,5,0.55)] p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-[min(560px,100%)] overflow-y-auto rounded-2xl border-2 border-[#050505] bg-white shadow-[6px_6px_0_#f47a4a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-[#050505] px-[1.15rem] py-4">
          <h2 className="m-0 text-[1.05rem] font-[950] text-[#050505]">
            {isEditing ? "축하 항목 수정" : "축하 항목 추가"}
          </h2>
          <button
            className="cursor-pointer border-0 bg-transparent text-[1.4rem] leading-none text-[#050505]"
            type="button"
            aria-label="닫기"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-4 p-[1.15rem]">
          <label className={fieldClass}>
            멤버 이름
            <input
              className={inputClass}
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="예: 남OO"
            />
          </label>
          <label className={fieldClass}>
            헤드라인
            <input
              className={inputClass}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="예: SK하이닉스 합격"
            />
          </label>
          <label className={fieldClass}>
            설명 (선택)
            <textarea
              className={`${inputClass} min-h-[90px] resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="축하 내용에 대한 짧은 설명"
            />
          </label>
          <label className={fieldClass}>
            달성 일자 (선택)
            <input
              className={inputClass}
              type="date"
              value={achievedAt}
              onChange={(e) => setAchievedAt(e.target.value)}
            />
          </label>
          <div className={fieldClass}>
            로고 / 이미지 (선택)
            <div className="flex items-center gap-[0.85rem]">
              <div className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-[#050505] bg-[#f3f3f1]">
                {logoUrl ? (
                  <img
                    className="h-full w-full object-contain"
                    src={logoUrl}
                    alt="logo preview"
                  />
                ) : (
                  <span style={{ fontSize: "0.7rem", color: "#999" }}>없음</span>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className={smallButtonClass()}
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "업로드 중…" : "업로드"}
                </button>
                {logoUrl && (
                  <button
                    className={smallButtonClass("ghost")}
                    type="button"
                    onClick={() => setLogoUrl("")}
                  >
                    제거
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={handleImageChange}
              />
            </div>
          </div>
          {error && (
            <p className="m-0 text-[0.82rem] font-bold text-[#991b1b]">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-[0.6rem] border-t-2 border-[#050505] px-[1.15rem] py-4">
          {isEditing && onDelete ? (
            <button
              className={smallButtonClass("danger")}
              type="button"
              disabled={saving}
              onClick={handleDelete}
            >
              삭제
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              className={smallButtonClass()}
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              취소
            </button>
            <button
              className="cursor-pointer rounded-full border-2 border-[#050505] bg-[#f47a4a] px-[1.3rem] py-[0.55rem] [font-family:inherit] text-[0.9rem] font-[900] text-[#050505] shadow-[3px_3px_0_#050505] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
              type="button"
              onClick={handleSave}
              disabled={saving || uploading}
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CelebrationEditor;
