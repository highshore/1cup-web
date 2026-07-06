"use client";

import React, { useState } from "react";
import styled from "styled-components";
import { supabase } from "../supabase/client";

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
`;

const Dialog = styled.div`
  background: white;
  border-radius: 20px;
  padding: 2.5rem;
  width: 90%;
  max-width: 440px;
  box-shadow: 0 10px 50px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 0, 0, 0.05);
  position: relative;
`;

const Title = styled.h2`
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #1f2937;
  text-align: center;
`;

const Description = styled.p`
  font-size: 0.95rem;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 2rem;
  text-align: center;
`;

const InputContainer = styled.div`
  margin-bottom: 2rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem 1.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.2s ease;
  background: #fafbfc;

  &:focus {
    outline: none;
    border-color: #2c1810;
    background: white;
    box-shadow: 0 0 0 3px rgba(44, 24, 16, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
`;

const Button = styled.button<{ variant?: "primary" | "secondary" }>`
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;

  ${({ variant }) =>
    variant === "primary"
      ? `
    background: #2c1810;
    color: white;

    &:hover {
      background: #3d2415;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(44, 24, 16, 0.25);
    }

    &:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  `
      : `
    background: #f3f4f6;
    color: #6b7280;

    &:hover {
      background: #e5e7eb;
    }
  `}
`;

interface DisplayNamePromptProps {
  onComplete: () => void;
}

export default function DisplayNamePrompt({
  onComplete,
}: DisplayNamePromptProps) {
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!displayName.trim()) {
      setError("닉네임을 입력해주세요.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }

    setIsLoading(true);
    setError("");

    const name = displayName.trim();

    try {
      // Mirror the name into Supabase Auth user metadata (replaces the old Auth profile update).
      await supabase.auth.updateUser({ data: { name } });

      // Update the users table row.
      const { error: updateError } = await supabase
        .from("users")
        .update({
          display_name: name,
          updated_at: new Date().toISOString(),
        })
        .eq("auth_id", user.id);

      if (updateError) throw updateError;

      onComplete();
    } catch (error) {
      console.error("Error updating display name:", error);
      setError("닉네임 설정에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    onComplete();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <Overlay>
      <Dialog>
        <Title>닉네임 설정</Title>
        <Description>
          닉네임 or 성함을 입력해주시면 운영진이 멤버 식별을 더 수월하게 할 수
          있습니다 🙇🏻‍♂️
        </Description>

        <InputContainer>
          <Input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="닉네임을 입력해주세요"
            autoFocus
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          {error && (
            <div
              style={{
                color: "#ef4444",
                fontSize: "0.85rem",
                marginTop: "0.5rem",
              }}
            >
              {error}
            </div>
          )}
        </InputContainer>

        <ButtonGroup>
          <Button variant="secondary" onClick={handleSkip} disabled={isLoading}>
            나중에
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading || !displayName.trim()}
          >
            {isLoading ? "설정 중..." : "설정하기"}
          </Button>
        </ButtonGroup>
      </Dialog>
    </Overlay>
  );
}
