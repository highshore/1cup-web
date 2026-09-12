"use client";

import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AcademicCapIcon,
  BriefcaseIcon,
  CameraIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  IdentificationIcon,
  LanguageIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PencilSquareIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";
import { useI18n } from "../lib/i18n/I18nProvider";
import { supabase } from "../lib/supabase/client";
import { AccountMembershipPanel } from "./account/AccountMembershipClient";
import { ConnectionsPanel } from "./connections/ConnectionsClient";
import {
  DesktopProfileShell,
  MobileProfileShell,
  type ProfileDetailsJson,
  type ProfileSection,
  useProfileShellData,
} from "./ProfileShell";

const INTEREST_CATEGORIES = [
  {
    key: "professional",
    items: [
      "Technology",
      "AI",
      "Startups",
      "Career",
      "Marketing & Sales",
      "Human Resources",
      "Product & Design",
      "Strategy",
      "Leadership & Management",
      "Teamwork",
      "Remote Work",
      "Corporate Culture",
      "Business",
      "Finance",
      "Entrepreneurship",
    ],
  },
  {
    key: "worldIdeas",
    items: [
      "Current affairs",
      "Science",
      "Society",
      "Culture",
      "Media",
      "Economics",
      "Politics & Policy",
      "Environment",
      "History",
      "Philosophy",
    ],
  },
  {
    key: "mindBody",
    items: [
      "Health",
      "Food",
      "Exercise & Fitness",
      "Longevity",
      "Mental Health",
      "Mindfulness",
      "Meditation",
      "Religion & Spirituality",
    ],
  },
  {
    key: "leisure",
    items: [
      "Entertainment",
      "Sports",
      "Music",
      "Movies & TV",
      "Books",
      "Gaming",
      "Travel",
      "Art & Photography",
      "Fashion",
      "Cooking",
    ],
  },
] as const;

const INTEREST_EMOJIS: Record<string, string> = {
  Technology: "💻",
  AI: "🤖",
  Startups: "🚀",
  Career: "💼",
  "Marketing & Sales": "🛒",
  "Human Resources": "🧑‍🤝‍🧑",
  "Product & Design": "📐",
  Strategy: "♟️",
  "Leadership & Management": "👑",
  Teamwork: "🧩",
  "Remote Work": "🏝️",
  "Corporate Culture": "🏢",
  Business: "📊",
  Finance: "💰",
  Entrepreneurship: "💡",
  "Current affairs": "📰",
  Science: "🔬",
  Society: "🌐",
  Culture: "🎭",
  Media: "📺",
  Economics: "📈",
  "Politics & Policy": "🏛️",
  Environment: "🌱",
  History: "🏺",
  Philosophy: "💭",
  Health: "🌿",
  Food: "🍏",
  "Exercise & Fitness": "👟",
  Longevity: "🧬",
  "Mental Health": "⭐",
  Mindfulness: "🧘",
  Meditation: "🌀",
  "Religion & Spirituality": "🕯️",
  Entertainment: "🎬",
  Sports: "🏀",
  Music: "🎵",
  "Movies & TV": "🍿",
  Books: "📚",
  Gaming: "🎮",
  Travel: "✈️",
  "Art & Photography": "📸",
  Fashion: "👗",
  Cooking: "🍳",
};

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type CefrLevel = (typeof CEFR_LEVELS)[number];

const CEFR_LEVEL_LABELS: Record<"en" | "ko", Record<CefrLevel, string>> = {
  en: {
    A1: "A1 — Novice",
    A2: "A2 — Beginner",
    B1: "B1 — Intermediate",
    B2: "B2 — Upper Intermediate",
    C1: "C1 — Advanced",
    C2: "C2 — Native",
  },
  ko: {
    A1: "A1 — 입문",
    A2: "A2 — 초급",
    B1: "B1 — 중급",
    B2: "B2 — 중상급",
    C1: "C1 — 고급",
    C2: "C2 — 원어민 수준",
  },
};

const LEGACY_LEVEL_MAP: Record<string, CefrLevel> = {
  Beginner: "A2",
  Intermediate: "B1",
  "Upper-intermediate": "B2",
  Advanced: "C1",
  "C1 Advanced": "C1",
  "Near-native": "C2",
};

const LANGUAGE_OPTIONS = [
  { value: "English", en: "English", ko: "영어" },
  { value: "Korean", en: "Korean", ko: "한국어" },
] as const;

const NATIONALITY_OPTIONS = [
  ["South Korea", "South Korean", "대한민국"],
  ["United States", "American", "미국"],
  ["Canada", "Canadian", "캐나다"],
  ["United Kingdom", "British", "영국"],
  ["Australia", "Australian", "호주"],
  ["New Zealand", "New Zealander", "뉴질랜드"],
  ["Japan", "Japanese", "일본"],
  ["China", "Chinese", "중국"],
  ["Taiwan", "Taiwanese", "대만"],
  ["Hong Kong", "Hong Konger", "홍콩"],
  ["Singapore", "Singaporean", "싱가포르"],
  ["India", "Indian", "인도"],
  ["Philippines", "Filipino", "필리핀"],
  ["Vietnam", "Vietnamese", "베트남"],
  ["Thailand", "Thai", "태국"],
  ["Indonesia", "Indonesian", "인도네시아"],
  ["Malaysia", "Malaysian", "말레이시아"],
  ["Germany", "German", "독일"],
  ["France", "French", "프랑스"],
  ["Italy", "Italian", "이탈리아"],
  ["Spain", "Spanish", "스페인"],
  ["Netherlands", "Dutch", "네덜란드"],
  ["Sweden", "Swedish", "스웨덴"],
  ["Switzerland", "Swiss", "스위스"],
  ["Poland", "Polish", "폴란드"],
  ["Russia", "Russian", "러시아"],
  ["Brazil", "Brazilian", "브라질"],
  ["Mexico", "Mexican", "멕시코"],
  ["Other", "Other", "기타"],
] as const;

const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 border-[#050505] bg-[#050505] px-4 text-[13px] font-extrabold text-white shadow-[3px_3px_0_#f47a4a] transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#f47a4a] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4";

const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 border-[#050505] bg-white px-4 text-[13px] font-extrabold text-[#050505] transition-[background-color,transform] hover:-translate-y-px hover:bg-[#fff8dc] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4";

const brandPanelClass =
  "rounded-[16px] border-2 border-[#050505] bg-white shadow-[3px_3px_0_rgba(5,5,5,0.92)]";

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function initials(name?: string | null) {
  return (
    (name || "Member")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "M"
  );
}

function FieldRow({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: ElementType;
  label: string;
  value: string;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-[50px] w-full grid-cols-[20px_1fr_minmax(110px,190px)_18px] items-center gap-2 border-0 border-b border-[rgba(5,5,5,0.14)] bg-transparent px-0 text-left last:border-b-0 max-[520px]:grid-cols-[20px_1fr_minmax(90px,140px)_18px]"
    >
      <Icon className="h-[18px] w-[18px] text-[#475569]" />
      <span className="text-[14px] font-bold text-[#050505]">{label}</span>
      <span className="truncate text-right text-[13px] font-medium text-[#64748b]">{value || t.profile.notSet}</span>
      <ChevronRightIcon className="h-[18px] w-[18px] text-[#475569]" />
    </button>
  );
}

function EditDialog({
  title,
  value,
  multiline,
  options,
  onClose,
  onSave,
}: {
  title: string;
  value: string;
  multiline?: boolean;
  options?: { value: string; label: string }[];
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/45 p-0 min-[600px]:items-center min-[600px]:p-5"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-t-[18px] border-2 border-[#050505] bg-white p-5 shadow-[6px_6px_0_rgba(5,5,5,0.92)] min-[600px]:rounded-[18px] min-[600px]:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="m-0 capitalize">{title}</h2>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#050505] bg-white hover:bg-[#fff8dc]" aria-label={t.profile.close}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {options ? (
          <div className={`grid gap-2 ${options.length > 8 ? "grid-cols-2 max-[520px]:grid-cols-1" : ""}`}>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraft(option.value)}
                className={`min-h-11 rounded-[12px] border-2 px-4 text-left text-[14px] font-bold ${
                  draft === option.value
                    ? "border-[#050505] bg-[#fff0e8] shadow-[2px_2px_0_#f47a4a]"
                    : "border-[rgba(5,5,5,0.16)] bg-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : multiline ? (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-[150px] w-full resize-y rounded-[12px] border-2 border-[rgba(5,5,5,0.18)] p-4 text-[14px] leading-[1.55] text-[#050505] outline-none focus:border-[#050505] focus:shadow-[2px_2px_0_#f47a4a]"
            autoFocus
          />
        ) : (
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-12 w-full rounded-[12px] border-2 border-[rgba(5,5,5,0.18)] px-4 text-[14px] text-[#050505] outline-none focus:border-[#050505] focus:shadow-[2px_2px_0_#f47a4a]"
            autoFocus
          />
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>{t.profile.cancel}</button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(draft.trim());
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className={primaryButtonClass}
          >
            {saving ? t.profile.saving : t.profile.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function LanguagesDialog({
  selected,
  locale,
  onClose,
  onSave,
}: {
  selected: string[];
  locale: "en" | "ko";
  onClose: () => void;
  onSave: (items: string[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const allowed = LANGUAGE_OPTIONS.map((option) => option.value);
  const [draft, setDraft] = useState(selected.filter((item) => allowed.includes(item as (typeof allowed)[number])));
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/45 min-[600px]:items-center min-[600px]:p-5" onMouseDown={onClose}>
      <div className="w-full max-w-[480px] rounded-t-[18px] border-2 border-[#050505] bg-white p-5 shadow-[6px_6px_0_rgba(5,5,5,0.92)] min-[600px]:rounded-[18px] min-[600px]:p-6" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0">{t.profile.languages}</h2>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#050505] bg-white hover:bg-[#fff8dc]" aria-label={t.profile.close}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {LANGUAGE_OPTIONS.map((option) => {
            const active = draft.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraft((current) => current.includes(option.value) ? current.filter((item) => item !== option.value) : [...current, option.value])}
                className={`flex min-h-[72px] items-center justify-between rounded-[14px] border-2 px-4 py-3 text-left text-[15px] font-extrabold ${active ? "border-[#050505] bg-[#fff0e8] shadow-[3px_3px_0_#f47a4a]" : "border-[rgba(5,5,5,0.16)] bg-white"}`}
              >
                <span>{option[locale]}</span>
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 ${active ? "border-[#050505] bg-[#f47a4a]" : "border-[#cbd5e1] bg-white"}`}>
                  {active ? <CheckIcon className="h-4 w-4" /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>{t.profile.cancel}</button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(draft);
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className={primaryButtonClass}
          >
            {saving ? t.profile.saving : t.profile.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function InterestsDialog({
  selected,
  onClose,
  onSave,
}: {
  selected: string[];
  onClose: () => void;
  onSave: (items: string[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(selected.slice(0, 5));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const labels = t.profile.interestLabels as Record<string, string>;

  const toggle = (item: string) => {
    setDraft((current) => {
      if (current.includes(item)) return current.filter((value) => value !== item);
      if (current.length >= 5) return current;
      return [...current, item];
    });
  };

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredCategories = INTEREST_CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter((item) =>
      !normalizedQuery || (labels[item] || item).toLocaleLowerCase().includes(normalizedQuery) || item.toLocaleLowerCase().includes(normalizedQuery),
    ),
  })).filter((category) => category.items.length > 0);

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/45 min-[600px]:items-center min-[600px]:p-5" onMouseDown={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-[600px] flex-col rounded-t-[18px] border-2 border-[#050505] bg-white shadow-[6px_6px_0_rgba(5,5,5,0.92)] min-[600px]:rounded-[18px]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(5,5,5,0.12)] p-5 min-[600px]:p-6">
          <div>
            <h2 className="m-0 capitalize">{t.profile.interests}</h2>
            <p className="mt-1.5 text-[13px] text-[#64748b]">{t.profile.interestsHelp}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#050505] bg-white hover:bg-[#fff8dc]" aria-label={t.profile.close}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 pt-4 min-[600px]:px-6">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#64748b]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.profile.interestSearchPlaceholder}
              className="h-12 w-full rounded-full border border-[rgba(5,5,5,0.1)] bg-[#f3f3f1] pl-11 pr-4 text-[14px] text-[#050505] outline-none focus:border-[#050505]"
            />
          </div>

          <div className="mt-5 grid gap-6">
            {filteredCategories.map((category) => (
              <section key={category.key}>
                <h3 className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
                  {t.profile[category.key]}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {category.items.map((item) => {
                    const active = draft.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggle(item)}
                        className={`min-h-9 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-[transform,background-color,border-color] hover:-translate-y-px ${
                          active
                            ? "border-[#050505] bg-[#f47a4a] text-[#050505] shadow-[2px_2px_0_rgba(5,5,5,0.92)]"
                            : "border-[rgba(5,5,5,0.08)] bg-[#f3f3f1] text-[#2f2f2f] hover:border-[rgba(5,5,5,0.25)] hover:bg-[#fff8dc]"
                        }`}
                      >
                        <span className="mr-1.5" aria-hidden="true">{INTEREST_EMOJIS[item]}</span>
                        {labels[item] || item}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[rgba(5,5,5,0.12)] bg-white p-4 min-[600px]:rounded-b-[16px] min-[600px]:px-6">
          <span className="text-[12px] font-bold text-[#64748b]">{interpolate(t.profile.selectedCount, { count: draft.length })}</span>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(draft);
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className={primaryButtonClass}
          >
            {saving ? t.profile.saving : t.profile.save}
          </button>
        </div>
      </div>
    </div>
  );
}

type EditKey = "name" | "bio" | "work" | "school" | "nationality" | "location" | "english_level";

function sectionFromParam(value: string | null): ProfileSection {
  return value === "connections" || value === "account" ? value : "edit";
}

export default function ProfileDashboardClient() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shell = useProfileShellData();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [dialog, setDialog] = useState<EditKey | null>(null);
  const [showInterests, setShowInterests] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sectionParam = searchParams.get("section");
  const activeSection = sectionFromParam(sectionParam);

  const navigateSection = (section: ProfileSection) => {
    router.replace(section === "edit" ? "/profile" : `/profile?section=${section}`, { scroll: false });
  };

  useEffect(() => {
    setAvatar(shell.currentUser?.photoURL ?? null);
    setDisplayName(shell.currentUser?.displayName ?? "");
  }, [shell.currentUser?.photoURL, shell.currentUser?.displayName]);

  const selectedInterests = useMemo(
    () => shell.summary.interests.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 5),
    [shell.summary.interests],
  );

  if (shell.authLoading || shell.loading) return <GlobalLoadingScreen />;
  if (!shell.currentUser) return null;

  const updateBase = async (patch: Record<string, unknown>) => {
    const { error } = await supabase
      .from("users")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("uid", shell.currentUser!.uid);
    if (error) throw error;
    await shell.refresh();
    shell.setNotice(t.profile.profileUpdated);
  };

  const updateDetails = async (patch: Partial<ProfileDetailsJson>) => {
    const profileDetails = { ...shell.summary.profileDetails, ...patch };
    await updateBase({ profile_details: profileDetails });
  };

  const saveDialogValue = async (key: EditKey, value: string) => {
    try {
      shell.setError(null);
      if (key === "name") {
        const { error: authError } = await supabase.auth.updateUser({ data: { name: value } });
        if (authError) throw authError;
        await updateBase({ display_name: value });
        setDisplayName(value);
        return;
      }
      if (key === "nationality") return updateDetails({ nationality: value });
      if (key === "english_level") return updateDetails({ english_level: value });
      await updateBase({ [key]: value });
    } catch (saveError) {
      console.error("Profile update failed:", saveError);
      shell.setError(t.profile.saveFieldFailed);
      throw saveError;
    }
  };

  const saveLanguages = async (items: string[]) => {
    try {
      shell.setError(null);
      await updateDetails({ languages: items.filter((item) => item === "English" || item === "Korean") });
    } catch (saveError) {
      console.error("Language update failed:", saveError);
      shell.setError(t.profile.saveFieldFailed);
      throw saveError;
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!shell.currentUser) return;
    if (file.size > 2 * 1024 * 1024) {
      shell.setError(t.profile.imageUnder2mb);
      return;
    }
    setUploading(true);
    shell.setError(null);
    try {
      const path = `${shell.currentUser.uid}/avatar.png`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = publicData.publicUrl;
      const { error: profileError } = await supabase
        .from("users")
        .update({ photo_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("uid", shell.currentUser.uid);
      if (profileError) throw profileError;
      await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      setAvatar(`${avatarUrl}?t=${Date.now()}`);
      shell.setNotice(t.profile.photoUpdated);
      await shell.refresh();
    } catch (uploadError) {
      console.error("Avatar upload failed:", uploadError);
      shell.setError(t.profile.photoUpdateFailed);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!shell.currentUser || !avatar) return;
    setUploading(true);
    try {
      const path = `${shell.currentUser.uid}/avatar.png`;
      await supabase.storage.from("avatars").remove([path]);
      const { error } = await supabase
        .from("users")
        .update({ photo_url: "", updated_at: new Date().toISOString() })
        .eq("uid", shell.currentUser.uid);
      if (error) throw error;
      await supabase.auth.updateUser({ data: { avatar_url: "" } });
      setAvatar(null);
      shell.setNotice(t.profile.photoRemoved);
      await shell.refresh();
    } catch (removeError) {
      console.error("Avatar removal failed:", removeError);
      shell.setError(t.profile.photoRemoveFailed);
    } finally {
      setUploading(false);
    }
  };

  const saveInterests = async (items: string[]) => {
    try {
      await updateBase({ interests: items.join(", ") });
    } catch (saveError) {
      shell.setError(t.profile.saveInterestsFailed);
      throw saveError;
    }
  };

  const fieldValue = (key: EditKey) => {
    switch (key) {
      case "name": return displayName;
      case "bio": return shell.summary.bio;
      case "work": return shell.summary.work;
      case "school": return shell.summary.school;
      case "nationality": return shell.summary.profileDetails.nationality || "";
      case "location": return shell.summary.location;
      case "english_level": return shell.summary.profileDetails.english_level || "";
    }
  };

  const dialogTitle: Record<EditKey, string> = {
    name: t.profile.name,
    bio: t.profile.bio,
    work: t.profile.work,
    school: t.profile.education,
    nationality: t.profile.nationality,
    location: t.profile.location,
    english_level: t.profile.englishLevel,
  };

  const labels = t.profile.interestLabels as Record<string, string>;
  const englishLevelOptions = CEFR_LEVELS.map((value) => ({ value, label: CEFR_LEVEL_LABELS[locale][value] }));
  const nationalityOptions = NATIONALITY_OPTIONS.map(([value, en, ko]) => ({ value, label: locale === "ko" ? ko : en }));
  const currentNationality = shell.summary.profileDetails.nationality || "";
  const nationalityLabel = NATIONALITY_OPTIONS.find(([value]) => value === currentNationality)?.[locale === "ko" ? 2 : 1] || currentNationality;
  const currentEnglishLevel = shell.summary.profileDetails.english_level || "";
  const normalizedEnglishLevel = LEGACY_LEVEL_MAP[currentEnglishLevel] || currentEnglishLevel;
  const englishLevelValue = (CEFR_LEVEL_LABELS[locale] as Record<string, string>)[normalizedEnglishLevel] || currentEnglishLevel;
  const selectedLanguages = (shell.summary.profileDetails.languages || []).filter((item) => item === "English" || item === "Korean");
  const languageValue = selectedLanguages.map((item) => LANGUAGE_OPTIONS.find((option) => option.value === item)?.[locale] || item).join(", ");

  const EditContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={mobile ? "px-4 pb-8 pt-5 sm:px-6" : "p-8"}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="m-0 capitalize">{t.profile.editProfile}</h1>
        <button
          type="button"
          onClick={() => router.push(`/profile/${encodeURIComponent(shell.currentUser!.uid)}`)}
          className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-extrabold text-[#e0602e] hover:underline [&_svg]:h-4 [&_svg]:w-4"
        >
          <EyeIcon />
          {t.profile.viewPublicProfile}
        </button>
      </div>

      <section className="mt-7">
        <h2 className="m-0 capitalize">{t.profile.profilePhoto}</h2>
        <div className="mt-4 flex items-center gap-6 max-[520px]:gap-4">
          <div className="flex h-[132px] w-[132px] flex-none items-center justify-center overflow-hidden rounded-full border-2 border-[#050505] bg-[#d1d1d1] text-[42px] font-extrabold text-white shadow-[4px_4px_0_#f47a4a] max-[520px]:h-[116px] max-[520px]:w-[116px] max-[520px]:text-[32px]">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials(displayName)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className={primaryButtonClass}>
                <CameraIcon />
                {uploading ? t.profile.working : t.profile.replacePhoto}
              </button>
              <button type="button" disabled={!avatar || uploading} onClick={() => void removeAvatar()} className={`${secondaryButtonClass} text-[#b42331]`}>
                <TrashIcon />
                {t.profile.remove}
              </button>
            </div>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadAvatar(file);
          event.target.value = "";
        }} />
      </section>

      <section className="mt-8">
        <h2 className="m-0 capitalize">{t.profile.interests}</h2>
        <p className="mt-1.5 text-[13px] text-[#64748b]">{t.profile.interestsHelp}</p>
        <button type="button" onClick={() => setShowInterests(true)} className={`${brandPanelClass} mt-4 flex min-h-[92px] w-full items-center justify-between px-4 py-4 text-left transition-transform hover:-translate-y-px`}>
          <div className="flex max-w-[500px] flex-wrap gap-2">
            {(selectedInterests.length ? selectedInterests : [t.profile.addInterests]).map((interest) => (
              <span key={interest} className={`rounded-full border-2 border-[#050505] px-3.5 py-2 text-[13px] font-bold ${selectedInterests.length ? "bg-[#f47a4a]" : "bg-white"}`}>
                {selectedInterests.length ? <><span className="mr-1.5" aria-hidden="true">{INTEREST_EMOJIS[interest]}</span>{labels[interest] || interest}</> : interest}
              </span>
            ))}
          </div>
          <ChevronRightIcon className="ml-3 h-5 w-5 flex-none text-[#475569]" />
        </button>
      </section>

      <section className="mt-8">
        <h2 className="m-0 capitalize">{t.profile.aboutYou}</h2>
        <div className={`${brandPanelClass} mt-4 overflow-hidden px-4`}>
          <FieldRow icon={UserIcon} label={t.profile.name} value={displayName} onClick={() => setDialog("name")} />
          <FieldRow icon={PencilSquareIcon} label={t.profile.bio} value={shell.summary.bio} onClick={() => setDialog("bio")} />
          <FieldRow icon={BriefcaseIcon} label={t.profile.work} value={shell.summary.work} onClick={() => setDialog("work")} />
          <FieldRow icon={AcademicCapIcon} label={t.profile.education} value={shell.summary.school} onClick={() => setDialog("school")} />
          <FieldRow icon={IdentificationIcon} label={t.profile.nationality} value={nationalityLabel} onClick={() => setDialog("nationality")} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="m-0 capitalize">{t.profile.languageMeetup}</h2>
        <p className="mt-1.5 text-[13px] text-[#64748b]">{t.profile.languageMeetupHelp}</p>
        <div className={`${brandPanelClass} mt-4 overflow-hidden px-4`}>
          <FieldRow icon={LanguageIcon} label={t.profile.languages} value={languageValue} onClick={() => setShowLanguages(true)} />
          <FieldRow icon={MapPinIcon} label={t.profile.location} value={shell.summary.location} onClick={() => setDialog("location")} />
          <FieldRow icon={ChatBubbleLeftRightIcon} label={t.profile.englishLevel} value={englishLevelValue} onClick={() => setDialog("english_level")} />
        </div>
      </section>
    </div>
  );

  const desktopContent =
    activeSection === "connections" ? (
      <ConnectionsPanel shell={shell} />
    ) : activeSection === "account" ? (
      <AccountMembershipPanel shell={shell} />
    ) : (
      <EditContent />
    );

  const mobileContent =
    activeSection === "connections" ? (
      <ConnectionsPanel shell={shell} mobile />
    ) : activeSection === "account" ? (
      <AccountMembershipPanel shell={shell} mobile />
    ) : (
      <EditContent mobile />
    );

  return (
    <>
      <DesktopProfileShell
        active={activeSection}
        data={shell}
        onSectionChange={navigateSection}
        avatarOverride={avatar}
        displayNameOverride={displayName}
      >
        {desktopContent}
      </DesktopProfileShell>

      <MobileProfileShell
        active={activeSection}
        data={shell}
        onSectionChange={navigateSection}
        avatarOverride={avatar}
        displayNameOverride={displayName}
      >
        {mobileContent}
      </MobileProfileShell>

      {dialog && (
        <EditDialog
          title={dialogTitle[dialog]}
          value={fieldValue(dialog)}
          multiline={dialog === "bio"}
          options={dialog === "english_level" ? englishLevelOptions : dialog === "nationality" ? nationalityOptions : undefined}
          onClose={() => setDialog(null)}
          onSave={(value) => saveDialogValue(dialog, value)}
        />
      )}

      {showLanguages && (
        <LanguagesDialog
          selected={selectedLanguages}
          locale={locale}
          onClose={() => setShowLanguages(false)}
          onSave={saveLanguages}
        />
      )}

      {showInterests && (
        <InterestsDialog
          selected={selectedInterests}
          onClose={() => setShowInterests(false)}
          onSave={saveInterests}
        />
      )}
    </>
  );
}
