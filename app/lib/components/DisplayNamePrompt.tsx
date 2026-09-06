"use client";

import React, { useState } from "react";
import { supabase } from "../supabase/client";

const buttonBaseClass =
  "cursor-pointer rounded-[10px] border-none px-6 py-3 text-[0.95rem] font-medium [transition:all_0.2s_ease]";

const primaryButtonClass = `${buttonBaseClass} bg-[#2c1810] text-white enabled:hover:-translate-y-px enabled:hover:bg-[#3d2415] enabled:hover:shadow-[0_4px_12px_rgba(44,24,16,0.25)] disabled:cursor-not-allowed disabled:bg-[#9ca3af]`;

const secondaryButtonClass = `${buttonBaseClass} bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]`;

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
      // Target the row by uid resolved through the auth-identity link table — a person
      // can have more than one auth user, so auth_id alone may not match their row.
      const { data: uid } = await supabase.rpc("current_uid");
      const { error: updateError } = await supabase
        .from("users")
        .update({
          display_name: name,
          updated_at: new Date().toISOString(),
        })
        .eq("uid", uid);

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-[4px]">
      <div className="relative w-[90%] max-w-[440px] rounded-[20px] border border-black/5 bg-white p-10 shadow-[0_10px_50px_rgba(0,0,0,0.15)]">
        <h2 className="mb-2 text-center text-[1.4rem] font-semibold text-[#1f2937]">
          닉네임 설정
        </h2>
        <p className="mb-8 text-center text-[0.95rem] leading-[1.6] text-[#6b7280]">
          닉네임 or 성함을 입력해주시면 운영진이 멤버 식별을 더 수월하게 할 수
          있습니다 🙇🏻‍♂️
        </p>

        <div className="mb-8">
          <input
            className="w-full rounded-xl border border-[#e5e7eb] bg-[#fafbfc] px-5 py-4 text-[1rem] [transition:all_0.2s_ease] placeholder:text-[#9ca3af] focus:border-[#2c1810] focus:bg-white focus:shadow-[0_0_0_3px_rgba(44,24,16,0.1)] focus:outline-none"
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
        </div>

        <div className="flex justify-end gap-3">
          <button
            className={secondaryButtonClass}
            onClick={handleSkip}
            disabled={isLoading}
          >
            나중에
          </button>
          <button
            className={primaryButtonClass}
            onClick={handleSubmit}
            disabled={isLoading || !displayName.trim()}
          >
            {isLoading ? "설정 중..." : "설정하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
