"use client";

import React, { useRef, useState } from "react";
import styled from "styled-components";

import { Celebration } from "../types/celebration_types";
import { uploadCelebrationImage } from "../services/celebration_image_service";

interface CelebrationEditorProps {
  celebration: Celebration | null;
  onSave: (data: Partial<Celebration>) => Promise<void> | void;
  onClose: () => void;
  onDelete?: (id: string) => Promise<void> | void;
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(5, 5, 5, 0.55);
  overflow-y: auto;
`;

const Modal = styled.div`
  width: min(560px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  border: 2px solid #050505;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 6px 6px 0 #f47a4a;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #050505;
  padding: 1rem 1.15rem;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 950;
  color: #050505;
`;

const CloseButton = styled.button`
  border: 0;
  background: transparent;
  color: #050505;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.15rem;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 800;
  color: #050505;
`;

const inputStyles = `
  border: 2px solid #050505;
  border-radius: 10px;
  background: #ffffff;
  padding: 0.6rem 0.7rem;
  font-family: inherit;
  font-size: 0.92rem;
  font-weight: 600;
  color: #050505;
  width: 100%;
  &:focus { outline: none; box-shadow: 2px 2px 0 #f47a4a; }
`;

const Input = styled.input`
  ${inputStyles}
`;

const Textarea = styled.textarea`
  ${inputStyles}
  min-height: 90px;
  resize: vertical;
`;

const ImageRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
`;

const Preview = styled.div`
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #f3f3f1;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

const SmallButton = styled.button<{ $variant?: "ghost" | "danger" }>`
  border: 2px solid #050505;
  border-radius: 999px;
  background: ${({ $variant }) =>
    $variant === "danger" ? "#fee2e2" : "#ffffff"};
  color: ${({ $variant }) => ($variant === "danger" ? "#991b1b" : "#050505")};
  padding: 0.4rem 0.85rem;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  border-top: 2px solid #050505;
  padding: 1rem 1.15rem;
`;

const PrimaryButton = styled.button`
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.55rem 1.3rem;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 3px 3px 0 #050505;
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const ErrorText = styled.p`
  margin: 0;
  color: #991b1b;
  font-size: 0.82rem;
  font-weight: 700;
`;

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
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>{isEditing ? "축하 항목 수정" : "축하 항목 추가"}</Title>
          <CloseButton type="button" aria-label="닫기" onClick={onClose}>
            ×
          </CloseButton>
        </Header>
        <Body>
          <Field>
            멤버 이름
            <Input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="예: 남OO"
            />
          </Field>
          <Field>
            헤드라인
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="예: SK하이닉스 합격"
            />
          </Field>
          <Field>
            설명 (선택)
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="축하 내용에 대한 짧은 설명"
            />
          </Field>
          <Field>
            달성 일자 (선택)
            <Input
              type="date"
              value={achievedAt}
              onChange={(e) => setAchievedAt(e.target.value)}
            />
          </Field>
          <Field as="div">
            로고 / 이미지 (선택)
            <ImageRow>
              <Preview>
                {logoUrl ? (
                  <img src={logoUrl} alt="logo preview" />
                ) : (
                  <span style={{ fontSize: "0.7rem", color: "#999" }}>없음</span>
                )}
              </Preview>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <SmallButton
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "업로드 중…" : "업로드"}
                </SmallButton>
                {logoUrl && (
                  <SmallButton
                    type="button"
                    $variant="ghost"
                    onClick={() => setLogoUrl("")}
                  >
                    제거
                  </SmallButton>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={handleImageChange}
              />
            </ImageRow>
          </Field>
          {error && <ErrorText>{error}</ErrorText>}
        </Body>
        <Footer>
          {isEditing && onDelete ? (
            <SmallButton
              type="button"
              $variant="danger"
              disabled={saving}
              onClick={handleDelete}
            >
              삭제
            </SmallButton>
          ) : (
            <span />
          )}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <SmallButton type="button" onClick={onClose} disabled={saving}>
              취소
            </SmallButton>
            <PrimaryButton
              type="button"
              onClick={handleSave}
              disabled={saving || uploading}
            >
              {saving ? "저장 중…" : "저장"}
            </PrimaryButton>
          </div>
        </Footer>
      </Modal>
    </Overlay>
  );
};

export default CelebrationEditor;
