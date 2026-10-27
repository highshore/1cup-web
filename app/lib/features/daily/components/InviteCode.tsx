"use client";

import { useEffect, useState } from "react";
import { DailyApiError, dailyApi } from "../api";
import { dailyCopy } from "../copy";
import { cn } from "./DailyUI";

/**
 * The invite code on the signup and subscribe pages. It starts filled when the visitor
 * came through a friend's link (?invite=CODE here, or one captured earlier on /daily),
 * and `apply` keeps whatever is in the field before the visitor moves on. The reward
 * itself is given at the first payment (terms 제5조의2), from the code kept here.
 */
export function useInviteCode() {
  const [code, setCode] = useState("");
  const [kept, setKept] = useState("");

  useEffect(() => {
    const fromLink = (new URLSearchParams(window.location.search).get("invite") ?? "").trim().toUpperCase();
    if (fromLink) {
      setCode(fromLink);
      dailyApi<{ kept: boolean }>("invite-capture", { code: fromLink })
        .then((result) => result.kept && setKept(fromLink))
        .catch(() => undefined);
      return;
    }
    dailyApi<{ code: string | null }>("invite-current")
      .then((result) => {
        if (!result.code) return;
        setCode(result.code);
        setKept(result.code);
      })
      .catch(() => undefined);
  }, []);

  /** Keeps the field's code for the first payment. Throws a message to show when it can't. */
  const apply = async () => {
    const value = code.trim().toUpperCase();
    if (value === kept) return;
    try {
      await dailyApi("invite-capture", { code: value });
      setKept(value);
    } catch (e) {
      throw new Error(e instanceof DailyApiError && e.message ? e.message : dailyCopy.invite.field.failed);
    }
  };

  return { code, setCode, apply };
}

export function InviteCodeField({
  value,
  onChange,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
}) {
  const f = dailyCopy.invite.field;
  return (
    <label className="block">
      <span className="sr-only">{f.label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
        placeholder={f.placeholder}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "h-12 w-full rounded-xl px-3 text-[1rem] font-black tracking-[0.12em] outline-none placeholder:font-bold placeholder:tracking-normal focus-visible:ring-2 focus-visible:ring-[#050505]",
          inputClassName,
        )}
      />
      <span className="mt-2 block text-[0.84rem] font-semibold text-[#64748b]">{f.detail}</span>
    </label>
  );
}
