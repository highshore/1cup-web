"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  ArrowRightOnRectangleIcon,
  BriefcaseIcon,
  CameraIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  EyeIcon,
  GlobeAltIcon,
  LanguageIcon,
  MapPinIcon,
  PencilIcon,
  PhotoIcon,
  SparklesIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";
import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import { supabase } from "../lib/supabase/client";
import { getParticipationCreditBalance } from "../lib/features/meetup/services/participation_service";

const ORANGE = "#f47a4a";
const CREAM = "#fff8f0";
const INK = "#171717";
const defaultUserImage = "/images/default_user.jpg";

type ViewMode = "overview" | "edit" | "completion";

type ProfileDetails = {
  nationality?: string;
  english_level?: string;
  languages?: string[];
  discussion_topics?: string[];
  meetup_preferences?: string[];
  [key: string]: unknown;
};

type ProfileRecord = {
  uid: string;
  display_name: string | null;
  photo_url: string | null;
  bio: string | null;
  work: string | null;
  school: string | null;
  location: string | null;
  interests: string | null;
  profile_public: boolean | null;
  profile_details: ProfileDetails | null;
  created_at: string | null;
  account_status: string | null;
  has_active_subscription: boolean | null;
  gdg_member: boolean | null;
};

type ProfileForm = {
  displayName: string;
  bio: string;
  work: string;
  school: string;
  location: string;
  nationality: string;
  englishLevel: string;
  languages: string[];
  discussionTopics: string[];
  meetupPreferences: string[];
  profilePublic: boolean;
};

const copy = {
  ko: {
    profile: "프로필",
    editProfile: "프로필 편집",
    completeProfile: "프로필 완성하기",
    profileStrength: "프로필 완성도",
    profilePotential: "프로필을 조금만 더 채워보세요",
    profilePotentialSub: "완성된 프로필은 밋업에서 서로를 알아가기 훨씬 쉽습니다.",
    profileReady: "프로필이 준비됐어요",
    profileReadySub: "이제 다른 멤버들이 당신을 더 잘 이해할 수 있습니다.",
    whatOthersSee: "다른 멤버에게 보이는 정보",
    membership: "멤버십",
    active: "이용 중",
    inactive: "비활성",
    managed: "초대/운영 멤버",
    credits: "참여권",
    creditsLeft: "회 남음",
    publicProfile: "공개 프로필 보기",
    connections: "연결된 멤버",
    accountSettings: "계정 · 멤버십 설정",
    accountSettingsSub: "결제, 로그인 수단, 추천 코드, 계정 관리",
    logOut: "로그아웃",
    memberSince: "년부터 영어 한잔 멤버",
    aboutYou: "About you",
    bio: "Bio",
    bioSub: "당신을 한두 문장으로 소개해 주세요.",
    bioPlaceholder: "어떤 사람인지, 어떤 이야기를 좋아하는지 간단히 적어주세요.",
    basicInfo: "기본 정보",
    work: "Work",
    school: "Education",
    location: "Location",
    nationality: "Nationality",
    english: "영어 · 언어",
    englishSub: "밋업에서 편하게 대화할 수 있도록 언어 정보를 알려주세요.",
    englishLevel: "English level",
    languages: "Languages",
    discussionTopics: "관심 주제",
    discussionTopicsSub: "밋업에서 이야기하고 싶은 주제를 골라보세요.",
    meetupPreferences: "밋업에서 원하는 것",
    meetupPreferencesSub: "영어 한잔에서 어떤 경험을 원하는지 알려주세요.",
    visibility: "프로필 공개",
    visibilitySub: "켜두면 다른 로그인 멤버가 공개 프로필을 볼 수 있습니다.",
    save: "저장",
    saving: "저장 중...",
    saved: "프로필을 저장했습니다.",
    saveFailed: "프로필 저장에 실패했습니다. 다시 시도해 주세요.",
    photo: "프로필 사진",
    photoSub: "실제 밋업에서 서로 알아볼 수 있는 사진을 추천합니다.",
    changePhoto: "사진 변경",
    photoFailed: "사진 업로드에 실패했습니다.",
    fileTooLarge: "2MB 이하의 이미지를 선택해 주세요.",
    addTopic: "직접 입력",
    add: "추가",
    completionPhoto: "사진",
    completionBio: "Bio",
    completionBasic: "기본 정보",
    completionEnglish: "영어 · 언어",
    completionTopics: "관심 주제",
    completionMeetup: "밋업 선호",
    notAdded: "아직 없음",
    added: "추가됨",
    back: "뒤로",
    settings: "설정",
    profilePreview: "내 공개 프로필",
  },
  en: {
    profile: "Profile",
    editProfile: "Edit profile",
    completeProfile: "Complete profile",
    profileStrength: "Profile strength",
    profilePotential: "Your profile has potential",
    profilePotentialSub: "A complete profile makes it much easier to connect at meetups.",
    profileReady: "Your profile is ready",
    profileReadySub: "Other members now have enough context to get to know you.",
    whatOthersSee: "What other members see",
    membership: "Membership",
    active: "Active",
    inactive: "Inactive",
    managed: "Hosted member",
    credits: "Meetup credits",
    creditsLeft: " left",
    publicProfile: "View public profile",
    connections: "Connections",
    accountSettings: "Account & membership",
    accountSettingsSub: "Billing, login methods, referrals and account controls",
    logOut: "Log out",
    memberSince: " member since ",
    aboutYou: "About you",
    bio: "Bio",
    bioSub: "Give other members a quick sense of who you are.",
    bioPlaceholder: "A little bit about you, what you do, and what you enjoy discussing.",
    basicInfo: "Basic info",
    work: "Work",
    school: "Education",
    location: "Location",
    nationality: "Nationality",
    english: "English & languages",
    englishSub: "Help members understand how you like to communicate at meetups.",
    englishLevel: "English level",
    languages: "Languages",
    discussionTopics: "Discussion topics",
    discussionTopicsSub: "Choose the topics you would most like to talk about.",
    meetupPreferences: "What I want from meetups",
    meetupPreferencesSub: "Tell us what kind of experience you want from One Cup.",
    visibility: "Public profile",
    visibilitySub: "When enabled, other signed-in members can view your public profile.",
    save: "Save profile",
    saving: "Saving...",
    saved: "Profile saved.",
    saveFailed: "We couldn't save your profile. Please try again.",
    photo: "Profile photo",
    photoSub: "Use a photo that makes it easy to recognise you at a meetup.",
    changePhoto: "Change photo",
    photoFailed: "We couldn't upload that photo.",
    fileTooLarge: "Choose an image under 2MB.",
    addTopic: "Add your own",
    add: "Add",
    completionPhoto: "Photo",
    completionBio: "Bio",
    completionBasic: "Basic info",
    completionEnglish: "English & languages",
    completionTopics: "Discussion topics",
    completionMeetup: "Meetup preferences",
    notAdded: "Not added",
    added: "Added",
    back: "Back",
    settings: "Settings",
    profilePreview: "My public profile",
  },
} as const;

const topicOptions = [
  { value: "technology", ko: "테크", en: "Technology" },
  { value: "business", ko: "비즈니스", en: "Business" },
  { value: "career", ko: "커리어", en: "Career" },
  { value: "current_affairs", ko: "시사", en: "Current affairs" },
  { value: "ai", ko: "AI", en: "AI" },
  { value: "startups", ko: "스타트업", en: "Startups" },
  { value: "culture", ko: "문화", en: "Culture" },
  { value: "society", ko: "사회", en: "Society" },
  { value: "finance", ko: "경제 · 금융", en: "Finance" },
  { value: "science", ko: "과학", en: "Science" },
] as const;

const meetupPreferenceOptions = [
  { value: "deep_discussion", ko: "깊이 있는 토론", en: "Deep discussions" },
  { value: "professional_networking", ko: "프로페셔널 네트워킹", en: "Professional networking" },
  { value: "career_exchange", ko: "커리어 교류", en: "Career exchange" },
  { value: "english_confidence", ko: "영어 자신감", en: "English confidence" },
  { value: "new_perspectives", ko: "새로운 관점", en: "New perspectives" },
  { value: "consistent_routine", ko: "꾸준한 루틴", en: "A consistent routine" },
] as const;

const languageOptions = ["Korean", "English", "Japanese", "Chinese", "Spanish", "French", "German"];
const englishLevels = ["A2", "B1", "B2", "C1", "C2", "Native / Bilingual"];

function ensureStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function csvToArray(value: string | null | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function labelForOption(
  value: string,
  options: readonly { value: string; ko: string; en: string }[],
  locale: "ko" | "en",
) {
  const option = options.find((item) => item.value === value);
  return option ? option[locale] : value;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-[52px] shrink-0 rounded-full border border-[#bdbdbd] transition-colors ${checked ? "bg-[#f47a4a]" : "bg-[#d9d9d9]"}`}
    >
      <span
        className={`absolute top-[3px] h-6 w-6 rounded-full border border-[#aaa] bg-white shadow-sm transition-transform ${checked ? "translate-x-[23px]" : "translate-x-[3px]"}`}
      />
    </button>
  );
}

function ThinRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className="flex min-h-[54px] w-full items-center gap-3 border-0 border-b border-[#ececec] bg-transparent px-0 py-3 text-left last:border-b-0"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f6f6f6] text-[#333] [&_svg]:h-[18px] [&_svg]:w-[18px]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-[0.93rem] font-[650] text-[#222]">{label}</span>
      {value && <span className="max-w-[48%] truncate text-right text-[0.86rem] text-[#6b6b6b]">{value}</span>}
      {onClick && <ChevronRightIcon className="h-[18px] w-[18px] shrink-0 text-[#777]" />}
    </Tag>
  );
}

function ChoiceChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-[0.48rem] text-[0.84rem] font-[650] transition ${
        selected
          ? "border-[#171717] bg-[#f47a4a] text-[#171717] shadow-[1px_1px_0_#171717]"
          : "border-[#d6d6d6] bg-white text-[#333] hover:border-[#999]"
      }`}
    >
      {children}
    </button>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="m-0 text-[1.2rem] font-[850] tracking-[-0.02em] text-[#242424]">{title}</h2>
      {subtitle && <p className="mb-0 mt-1 text-[0.83rem] leading-[1.45] text-[#777]">{subtitle}</p>}
    </div>
  );
}

export default function BumbleProfileClient() {
  const router = useRouter();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "ko";
  const c = copy[lang];
  const { currentUser: user, isLoading: authLoading, logout } = useAuth();

  const [view, setView] = useState<ViewMode>("overview");
  const [record, setRecord] = useState<ProfileRecord | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [creditBalance, setCreditBalance] = useState(0);
  const [customTopic, setCustomTopic] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth?redirect=%2Fprofile");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
        .from("users")
        .select(
          "uid,display_name,photo_url,bio,work,school,location,interests,profile_public,profile_details,created_at,account_status,has_active_subscription,gdg_member",
        )
        .eq("uid", user.uid)
        .maybeSingle();

      if (cancelled) return;
      if (queryError || !data) {
        setError(queryError?.message || "Profile not found");
        setLoading(false);
        return;
      }

      const profile = data as ProfileRecord;
      const details = profile.profile_details || {};
      const structuredTopics = ensureStringArray(details.discussion_topics);

      setRecord(profile);
      setForm({
        displayName: profile.display_name || user.displayName || "",
        bio: profile.bio || "",
        work: profile.work || "",
        school: profile.school || "",
        location: profile.location || "",
        nationality: typeof details.nationality === "string" ? details.nationality : "",
        englishLevel: typeof details.english_level === "string" ? details.english_level : "",
        languages: ensureStringArray(details.languages),
        discussionTopics: structuredTopics.length ? structuredTopics : csvToArray(profile.interests),
        meetupPreferences: ensureStringArray(details.meetup_preferences),
        profilePublic: profile.profile_public === true,
      });

      try {
        const balance = await getParticipationCreditBalance(user.uid);
        if (!cancelled) setCreditBalance(balance);
      } catch {
        if (!cancelled) setCreditBalance(0);
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, router, user]);

  const completionItems = useMemo(() => {
    if (!form || !record) return [];
    const basicCount = [form.work, form.school, form.location].filter((item) => item.trim()).length;
    const englishCount = [form.englishLevel, form.languages.length ? "yes" : ""].filter(Boolean).length;
    return [
      { key: "photo", label: c.completionPhoto, done: Boolean(record.photo_url || user?.photoURL), detail: record.photo_url || user?.photoURL ? c.added : c.notAdded, icon: <PhotoIcon /> },
      { key: "bio", label: c.completionBio, done: Boolean(form.bio.trim()), detail: form.bio.trim() ? c.added : c.notAdded, icon: <PencilIcon /> },
      { key: "basic", label: c.completionBasic, done: basicCount === 3, detail: `${basicCount}/3`, icon: <BriefcaseIcon /> },
      { key: "english", label: c.completionEnglish, done: englishCount === 2, detail: `${englishCount}/2`, icon: <LanguageIcon /> },
      { key: "topics", label: c.completionTopics, done: form.discussionTopics.length >= 3, detail: `${form.discussionTopics.length}/3+`, icon: <SparklesIcon /> },
      { key: "meetup", label: c.completionMeetup, done: form.meetupPreferences.length >= 2, detail: `${form.meetupPreferences.length}/2+`, icon: <UserGroupIcon /> },
    ];
  }, [c, form, record, user?.photoURL]);

  const completion = useMemo(() => {
    if (!completionItems.length) return 0;
    return Math.round((completionItems.filter((item) => item.done).length / completionItems.length) * 100);
  }, [completionItems]);

  if (loading || authLoading || !form || !record || !user) return <GlobalLoadingScreen />;

  const photoUrl = record.photo_url || user.photoURL || defaultUserImage;
  const isManagedMember = record.account_status === "admin" || record.account_status === "leader" || record.gdg_member === true;
  const membershipLabel = isManagedMember ? c.managed : record.has_active_subscription ? c.active : c.inactive;
  const memberYear = record.created_at ? new Date(record.created_at).getFullYear() : null;

  function updateForm<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function toggleArrayField(key: "languages" | "discussionTopics" | "meetupPreferences", value: string) {
    setForm((current) => {
      if (!current) return current;
      const values = current[key];
      return {
        ...current,
        [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
      };
    });
  }

  function addCustomTopic() {
    const topic = customTopic.trim();
    if (!topic || form.discussionTopics.includes(topic)) return;
    updateForm("discussionTopics", [...form.discussionTopics, topic].slice(0, 12));
    setCustomTopic("");
  }

  async function saveProfile() {
    setSaving(true);
    setError("");
    setMessage("");

    const profileDetails: ProfileDetails = {
      ...(record.profile_details || {}),
      nationality: form.nationality.trim(),
      english_level: form.englishLevel,
      languages: form.languages,
      discussion_topics: form.discussionTopics,
      meetup_preferences: form.meetupPreferences,
    };

    const { error: updateError } = await supabase
      .from("users")
      .update({
        display_name: form.displayName.trim(),
        bio: form.bio.trim(),
        work: form.work.trim(),
        school: form.school.trim(),
        location: form.location.trim() || "anam",
        interests: form.discussionTopics.join(", "),
        profile_public: form.profilePublic,
        profile_details: profileDetails,
        updated_at: new Date().toISOString(),
      })
      .eq("uid", user.uid);

    if (!updateError && form.displayName.trim() !== (record.display_name || "")) {
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: form.displayName.trim() },
      });
      if (authError) console.warn("Profile name metadata update failed:", authError.message);
    }

    setSaving(false);

    if (updateError) {
      setError(c.saveFailed);
      return;
    }

    setRecord((current) =>
      current
        ? {
            ...current,
            display_name: form.displayName.trim(),
            bio: form.bio.trim(),
            work: form.work.trim(),
            school: form.school.trim(),
            location: form.location.trim() || "anam",
            interests: form.discussionTopics.join(", "),
            profile_public: form.profilePublic,
            profile_details: profileDetails,
          }
        : current,
    );
    setMessage(c.saved);
    setView("overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError(c.fileTooLarge);
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    const avatarPath = `${user.uid}/avatar.png`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(avatarPath, file, { upsert: true });
    if (uploadError) {
      setUploading(false);
      setError(c.photoFailed);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(avatarPath);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
    const cleanUrl = data.publicUrl;

    const { error: profileError } = await supabase
      .from("users")
      .update({ photo_url: cleanUrl, updated_at: new Date().toISOString() })
      .eq("uid", user.uid);

    if (!profileError) {
      await supabase.auth.updateUser({ data: { avatar_url: cleanUrl } }).catch(() => undefined);
      setRecord((current) => (current ? { ...current, photo_url: publicUrl } : current));
    }

    setUploading(false);
    if (profileError) setError(c.photoFailed);
  }

  const alert = error || message;

  if (view === "completion") {
    return (
      <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-[620px] bg-white px-4 pb-14 pt-5 text-[#171717] sm:px-6">
        <header className="grid grid-cols-[44px_1fr_44px] items-center">
          <button type="button" onClick={() => setView("overview")} aria-label={c.back} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent text-[#222] hover:bg-[#f5f5f5]">
            <XMarkIcon className="h-7 w-7" />
          </button>
          <div className="text-center text-[0.95rem] font-[750]">{completion}% complete</div>
          <span />
        </header>

        <section className="pt-4 text-center">
          <div
            className="mx-auto grid h-[92px] w-[92px] place-items-center rounded-full"
            style={{ background: `conic-gradient(${ORANGE} 0 ${completion}%, #e6e6e6 ${completion}% 100%)` }}
          >
            <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-white text-[1.45rem] font-[850]">{completion}%</div>
          </div>
          <h1 className="mb-0 mt-5 text-[1.45rem] font-[850] tracking-[-0.025em]">{completion === 100 ? c.profileReady : c.profilePotential}</h1>
          <p className="mx-auto mb-0 mt-1 max-w-[400px] text-[0.92rem] leading-[1.5] text-[#5f5f5f]">{completion === 100 ? c.profileReadySub : c.profilePotentialSub}</p>
        </section>

        <section className="mt-7 grid grid-cols-2 gap-3">
          {completionItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView("edit")}
              className="min-h-[142px] rounded-[18px] border border-[#dedede] bg-white p-4 text-center transition hover:-translate-y-[1px] hover:shadow-sm"
            >
              <span className={`mx-auto grid h-11 w-11 place-items-center rounded-full [&_svg]:h-6 [&_svg]:w-6 ${item.done ? "bg-[#ffe2d5] text-[#8a3213]" : "bg-[#f3f3f3] text-[#444]"}`}>{item.icon}</span>
              <strong className="mt-3 block text-[0.95rem]">{item.label}</strong>
              <span className="mt-1 block text-[0.8rem] text-[#777]">{item.detail}</span>
            </button>
          ))}
        </section>

        <button type="button" onClick={() => setView("edit")} className="mt-6 w-full rounded-full border-0 bg-[#171717] px-5 py-3.5 text-[0.95rem] font-[750] text-white hover:opacity-90">
          {c.completeProfile}
        </button>
      </main>
    );
  }

  if (view === "edit") {
    return (
      <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-[620px] bg-white px-4 pb-32 pt-4 text-[#171717] sm:px-6">
        <header className="sticky top-[60px] z-20 -mx-4 grid grid-cols-[44px_1fr_72px] items-center border-b border-[#efefef] bg-white/95 px-4 py-1 backdrop-blur sm:-mx-6 sm:px-6">
          <button type="button" onClick={() => setView("overview")} aria-label={c.back} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent hover:bg-[#f5f5f5]">
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          <h1 className="m-0 text-center text-[1rem] font-[750]">{c.editProfile}</h1>
          <button type="button" onClick={() => void saveProfile()} disabled={saving} className="justify-self-end rounded-full border-0 bg-[#171717] px-4 py-2 text-[0.82rem] font-[750] text-white disabled:opacity-50">
            {saving ? c.saving : c.save}
          </button>
        </header>

        {alert && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-[0.87rem] font-[650] ${error ? "bg-[#fff0f0] text-[#a52b2b]" : "bg-[#eef8ee] text-[#27622b]"}`}>{alert}</div>
        )}

        <button type="button" onClick={() => setView("completion")} className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-[#e4e4e4] bg-[#fafafa] px-4 py-3 text-left">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5e5e5]"><div className="h-full rounded-full bg-[#f47a4a]" style={{ width: `${completion}%` }} /></div>
          <strong className="text-[0.86rem]">{completion}%</strong>
          <ChevronRightIcon className="h-4 w-4 text-[#777]" />
        </button>

        <section className="mt-8">
          <SectionHeading title={c.photo} subtitle={c.photoSub} />
          <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative aspect-[4/3] overflow-hidden rounded-[18px] border border-[#d7d7d7] bg-[#f4f4f4] p-0">
              <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = defaultUserImage; }} />
              <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-[0.75rem] font-[750] shadow-sm">Main</span>
              <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-[#f47a4a] text-[#171717] shadow [&_svg]:h-5 [&_svg]:w-5"><CameraIcon /></span>
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="grid min-h-[112px] place-items-center rounded-[18px] border border-dashed border-[#c9c9c9] bg-[#fafafa] text-center text-[#555]">
              <span><CameraIcon className="mx-auto h-6 w-6" /><span className="mt-2 block text-[0.78rem] font-[700]">{uploading ? "..." : c.changePhoto}</span></span>
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        </section>

        <section className="mt-9">
          <SectionHeading title={c.bio} subtitle={c.bioSub} />
          <textarea
            value={form.bio}
            maxLength={280}
            onChange={(event) => updateForm("bio", event.target.value)}
            placeholder={c.bioPlaceholder}
            className="min-h-[112px] w-full resize-none rounded-[18px] border border-[#dedede] bg-white px-4 py-3 text-[0.92rem] leading-[1.55] outline-none transition focus:border-[#f47a4a] focus:ring-2 focus:ring-[#f47a4a]/20"
          />
          <div className="mt-1 text-right text-[0.72rem] text-[#999]">{form.bio.length}/280</div>
        </section>

        <section className="mt-8">
          <SectionHeading title={c.basicInfo} />
          <div className="rounded-[18px] border border-[#e3e3e3] px-4">
            <label className="grid min-h-[62px] grid-cols-[28px_110px_1fr] items-center gap-2 border-b border-[#ececec] last:border-b-0">
              <BriefcaseIcon className="h-[19px] w-[19px] text-[#444]" /><span className="text-[0.88rem] font-[650]">{c.work}</span><input value={form.work} onChange={(event) => updateForm("work", event.target.value)} placeholder="SAP · Developer" className="min-w-0 border-0 bg-transparent text-right text-[0.86rem] text-[#555] outline-none" />
            </label>
            <label className="grid min-h-[62px] grid-cols-[28px_110px_1fr] items-center gap-2 border-b border-[#ececec] last:border-b-0">
              <AcademicCapIcon className="h-[19px] w-[19px] text-[#444]" /><span className="text-[0.88rem] font-[650]">{c.school}</span><input value={form.school} onChange={(event) => updateForm("school", event.target.value)} placeholder="Korea University" className="min-w-0 border-0 bg-transparent text-right text-[0.86rem] text-[#555] outline-none" />
            </label>
            <label className="grid min-h-[62px] grid-cols-[28px_110px_1fr] items-center gap-2 border-b border-[#ececec] last:border-b-0">
              <MapPinIcon className="h-[19px] w-[19px] text-[#444]" /><span className="text-[0.88rem] font-[650]">{c.location}</span><input value={form.location} onChange={(event) => updateForm("location", event.target.value)} placeholder="Seoul" className="min-w-0 border-0 bg-transparent text-right text-[0.86rem] text-[#555] outline-none" />
            </label>
            <label className="grid min-h-[62px] grid-cols-[28px_110px_1fr] items-center gap-2">
              <GlobeAltIcon className="h-[19px] w-[19px] text-[#444]" /><span className="text-[0.88rem] font-[650]">{c.nationality}</span><input value={form.nationality} onChange={(event) => updateForm("nationality", event.target.value)} placeholder="Korea" className="min-w-0 border-0 bg-transparent text-right text-[0.86rem] text-[#555] outline-none" />
            </label>
          </div>
        </section>

        <section className="mt-9">
          <SectionHeading title={c.english} subtitle={c.englishSub} />
          <h3 className="mb-2 mt-0 text-[0.84rem] font-[750] text-[#444]">{c.englishLevel}</h3>
          <div className="flex flex-wrap gap-2">
            {englishLevels.map((level) => <ChoiceChip key={level} selected={form.englishLevel === level} onClick={() => updateForm("englishLevel", form.englishLevel === level ? "" : level)}>{level}</ChoiceChip>)}
          </div>
          <h3 className="mb-2 mt-5 text-[0.84rem] font-[750] text-[#444]">{c.languages}</h3>
          <div className="flex flex-wrap gap-2">
            {languageOptions.map((language) => <ChoiceChip key={language} selected={form.languages.includes(language)} onClick={() => toggleArrayField("languages", language)}>{language}</ChoiceChip>)}
          </div>
        </section>

        <section className="mt-9">
          <SectionHeading title={c.discussionTopics} subtitle={c.discussionTopicsSub} />
          <div className="flex flex-wrap gap-2">
            {topicOptions.map((topic) => <ChoiceChip key={topic.value} selected={form.discussionTopics.includes(topic.value)} onClick={() => toggleArrayField("discussionTopics", topic.value)}>{topic[lang]}</ChoiceChip>)}
            {form.discussionTopics.filter((topic) => !topicOptions.some((option) => option.value === topic)).map((topic) => <ChoiceChip key={topic} selected onClick={() => toggleArrayField("discussionTopics", topic)}>{topic} ×</ChoiceChip>)}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomTopic(); } }} placeholder={c.addTopic} className="min-w-0 flex-1 rounded-full border border-[#d8d8d8] px-4 py-2 text-[0.84rem] outline-none focus:border-[#f47a4a]" />
            <button type="button" onClick={addCustomTopic} className="rounded-full border-0 bg-[#171717] px-4 py-2 text-[0.82rem] font-[700] text-white">{c.add}</button>
          </div>
        </section>

        <section className="mt-9">
          <SectionHeading title={c.meetupPreferences} subtitle={c.meetupPreferencesSub} />
          <div className="flex flex-wrap gap-2">
            {meetupPreferenceOptions.map((preference) => <ChoiceChip key={preference.value} selected={form.meetupPreferences.includes(preference.value)} onClick={() => toggleArrayField("meetupPreferences", preference.value)}>{preference[lang]}</ChoiceChip>)}
          </div>
        </section>

        <section className="mt-9">
          <SectionHeading title={c.visibility} subtitle={c.visibilitySub} />
          <div className="flex items-center justify-between rounded-[18px] border border-[#e3e3e3] px-4 py-4">
            <div className="flex items-center gap-3"><EyeIcon className="h-5 w-5 text-[#444]" /><span className="text-[0.9rem] font-[650]">{c.visibility}</span></div>
            <Toggle checked={form.profilePublic} onChange={(value) => updateForm("profilePublic", value)} label={c.visibility} />
          </div>
        </section>

        <button type="button" onClick={() => void saveProfile()} disabled={saving} className="fixed bottom-5 left-1/2 z-30 w-[min(calc(100%-2rem),572px)] -translate-x-1/2 rounded-full border-0 bg-[#f47a4a] px-5 py-4 text-[0.95rem] font-[850] text-[#171717] shadow-[0_8px_30px_rgba(0,0,0,0.16)] disabled:opacity-60">
          {saving ? c.saving : c.save}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-[620px] bg-white px-4 pb-14 pt-5 text-[#171717] sm:px-6">
      <header className="flex items-center justify-between">
        <h1 className="m-0 text-[2rem] font-[850] tracking-[-0.035em]">{c.profile}</h1>
        <button type="button" onClick={() => router.push("/profile/account")} aria-label={c.settings} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent hover:bg-[#f4f4f4]">
          <Cog6ToothIcon className="h-7 w-7" />
        </button>
      </header>

      {alert && (
        <div className={`mt-4 rounded-xl px-4 py-3 text-[0.87rem] font-[650] ${error ? "bg-[#fff0f0] text-[#a52b2b]" : "bg-[#eef8ee] text-[#27622b]"}`}>{alert}</div>
      )}

      <section className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="relative h-[70px] w-[70px] shrink-0 rounded-full border-0 bg-transparent p-0">
          <img src={photoUrl} alt="Profile" className="h-full w-full rounded-full border border-[#d6d6d6] object-cover" onError={(event) => { event.currentTarget.src = defaultUserImage; }} />
          <span className="absolute -bottom-1 -left-1 rounded-full border-2 border-white bg-[#171717] px-2 py-[0.2rem] text-[0.66rem] font-[800] text-white">{completion}%</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[1.18rem] font-[800]">{form.displayName || user.displayName || "One Cup Member"}</div>
          {memberYear && <div className="mt-1 text-[0.78rem] text-[#777]">{lang === "ko" ? `${memberYear}${c.memberSince}` : `${c.memberSince}${memberYear}`}</div>}
          <button type="button" onClick={() => setView("completion")} className="mt-2 rounded-full border-0 bg-[#f1f1f1] px-3 py-1.5 text-[0.76rem] font-[700] text-[#333] hover:bg-[#e9e9e9]">{c.completeProfile}</button>
        </div>
      </section>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.currentTarget.value = ""; }} />

      <button type="button" onClick={() => setView("edit")} className="mt-6 flex w-full items-center gap-4 rounded-[18px] border border-[#dedede] bg-white px-4 py-4 text-left shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ffe0d2] text-[#8f3515]"><PencilIcon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><strong className="block text-[0.96rem]">{c.editProfile}</strong><span className="mt-0.5 block text-[0.78rem] text-[#777]">{completion}% · {c.whatOthersSee}</span></div>
        <ChevronRightIcon className="h-5 w-5 text-[#777]" />
      </button>

      <section className="mt-5 rounded-[20px] px-5 py-5" style={{ background: ORANGE }}>
        <div className="flex items-start justify-between gap-4">
          <div><div className="text-[0.78rem] font-[800] uppercase tracking-[0.08em] text-[#54200c]">{c.profileStrength}</div><h2 className="mb-0 mt-1 text-[1.2rem] font-[850] tracking-[-0.02em] text-[#171717]">{completion === 100 ? c.profileReady : c.profilePotential}</h2></div>
          <strong className="text-[1.5rem] font-[900]">{completion}%</strong>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/55"><div className="h-full rounded-full bg-[#171717]" style={{ width: `${completion}%` }} /></div>
        <button type="button" onClick={() => setView("completion")} className="mt-4 rounded-full border border-[#171717] bg-[#171717] px-4 py-2 text-[0.78rem] font-[750] text-white">{c.completeProfile}</button>
      </section>

      <section className="mt-7">
        <SectionHeading title={c.whatOthersSee} />
        <div className="rounded-[20px] border border-[#e0e0e0] px-4">
          <ThinRow icon={<PencilIcon />} label={c.bio} value={form.bio || c.notAdded} onClick={() => setView("edit")} />
          <ThinRow icon={<BriefcaseIcon />} label={c.work} value={form.work || c.notAdded} onClick={() => setView("edit")} />
          <ThinRow icon={<AcademicCapIcon />} label={c.school} value={form.school || c.notAdded} onClick={() => setView("edit")} />
          <ThinRow icon={<LanguageIcon />} label={c.englishLevel} value={form.englishLevel || c.notAdded} onClick={() => setView("edit")} />
          <ThinRow icon={<SparklesIcon />} label={c.discussionTopics} value={form.discussionTopics.length ? `${form.discussionTopics.length}` : c.notAdded} onClick={() => setView("edit")} />
        </div>
      </section>

      <section className="mt-7 grid grid-cols-2 gap-3">
        <div className="rounded-[18px] border border-[#e0e0e0] p-4"><CreditCardIcon className="h-5 w-5 text-[#555]" /><div className="mt-3 text-[0.76rem] text-[#777]">{c.membership}</div><div className="mt-1 text-[0.95rem] font-[800]">{membershipLabel}</div></div>
        <div className="rounded-[18px] border border-[#e0e0e0] p-4"><CheckCircleIcon className="h-5 w-5 text-[#555]" /><div className="mt-3 text-[0.76rem] text-[#777]">{c.credits}</div><div className="mt-1 text-[0.95rem] font-[800]">{lang === "ko" ? `${creditBalance}${c.creditsLeft}` : `${creditBalance}${c.creditsLeft}`}</div></div>
      </section>

      <section className="mt-7">
        <div className="rounded-[20px] border border-[#e0e0e0] px-4">
          <ThinRow icon={<EyeIcon />} label={c.publicProfile} onClick={() => router.push(`/profile/${user.uid}`)} />
          <ThinRow icon={<UserGroupIcon />} label={c.connections} onClick={() => router.push("/profile/connections")} />
          <ThinRow icon={<Cog6ToothIcon />} label={c.accountSettings} value={c.accountSettingsSub} onClick={() => router.push("/profile/account")} />
          <ThinRow icon={<ArrowRightOnRectangleIcon />} label={c.logOut} onClick={() => { void logout().then(() => router.replace("/")); }} />
        </div>
      </section>

      <p className="mt-7 text-center text-[0.72rem] leading-[1.5] text-[#9a9a9a]">Inspired by the profile-editing interaction model used by leading social products, adapted for One Cup English.</p>
    </main>
  );
}
