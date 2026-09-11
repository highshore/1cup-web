"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";
import { supabase } from "../lib/supabase/client";
import { AccountMembershipPanel } from "./account/AccountMembershipClient";
import { ConnectionsPanel } from "./connections/ConnectionsClient";
import {
  DesktopProfileShell,
  MobileProfileHub,
  type ProfileDetailsJson,
  type ProfileSection,
  useProfileShellData,
} from "./ProfileShell";

const INTEREST_OPTIONS = [
  "Technology",
  "Business",
  "Career",
  "Current affairs",
  "AI",
  "Culture",
  "Startups",
  "Science",
  "Design",
  "Finance",
  "Society",
  "Media",
];

const ENGLISH_LEVELS = [
  "Beginner",
  "Intermediate",
  "Upper-intermediate",
  "Advanced",
  "C1 Advanced",
  "Near-native",
];

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
  icon,
  label,
  value,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-[49px] w-full grid-cols-[18px_1fr_minmax(110px,190px)_18px] items-center gap-2 border-0 border-b border-[rgba(5,5,5,0.1)] bg-transparent px-0 text-left last:border-b-0 max-[520px]:grid-cols-[18px_1fr_minmax(90px,140px)_18px]"
    >
      <span className="text-center text-[14px] text-[#6c757d]">{icon}</span>
      <span className="text-[14px] font-semibold text-[#050505]">{label}</span>
      <span className="truncate text-right text-[13px] text-[#6c757d]">{value || "Not set"}</span>
      <span className="text-[22px] leading-none text-[#6c757d]">›</span>
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
  options?: string[];
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 p-0 min-[600px]:items-center min-[600px]:p-5"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-t-[20px] bg-white p-5 shadow-[0_16px_48px_rgba(5,5,5,0.18)] min-[600px]:rounded-[20px] min-[600px]:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="m-0">{title}</h2>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full border-0 bg-[#f5f5f5] text-[22px] text-[#6c757d]">×</button>
        </div>

        {options ? (
          <div className="grid gap-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDraft(option)}
                className={`min-h-11 rounded-[14px] border-[1.5px] px-4 text-left text-[14px] font-semibold ${
                  draft === option
                    ? "border-[#f47a4a] bg-[#fff0e8] text-[#050505]"
                    : "border-[rgba(5,5,5,0.12)] bg-white text-[#050505]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        ) : multiline ? (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-[150px] w-full resize-y rounded-[14px] border-[1.5px] border-[rgba(5,5,5,0.14)] p-4 text-[14px] leading-[1.55] text-[#050505] outline-none focus:border-[#f47a4a]"
            autoFocus
          />
        ) : (
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-12 w-full rounded-[14px] border-[1.5px] border-[rgba(5,5,5,0.14)] px-4 text-[14px] text-[#050505] outline-none focus:border-[#f47a4a]"
            autoFocus
          />
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-10 rounded-full border-[1.5px] border-[rgba(5,5,5,0.14)] bg-white px-5 text-[13px] font-semibold text-[#050505]">Cancel</button>
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
            className="min-h-10 rounded-full border-0 bg-[#050505] px-5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
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
  const [draft, setDraft] = useState(selected.slice(0, 5));
  const [saving, setSaving] = useState(false);

  const toggle = (item: string) => {
    setDraft((current) => {
      if (current.includes(item)) return current.filter((value) => value !== item);
      if (current.length >= 5) return current;
      return [...current, item];
    });
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40 min-[600px]:items-center min-[600px]:p-5" onMouseDown={onClose}>
      <div className="w-full max-w-[560px] rounded-t-[20px] bg-white p-5 shadow-[0_16px_48px_rgba(5,5,5,0.18)] min-[600px]:rounded-[20px] min-[600px]:p-6" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="m-0">Interests</h2>
            <p className="mt-1.5 text-[13px] text-[#6c757d]">Choose up to 5 topics you enjoy talking about.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full border-0 bg-[#f5f5f5] text-[22px] text-[#6c757d]">×</button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((item) => {
            const active = draft.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggle(item)}
                className={`min-h-9 rounded-full border-[1.5px] px-4 py-2 text-[13px] font-semibold ${
                  active
                    ? "border-[#050505] bg-[#f47a4a] text-[#050505]"
                    : "border-transparent bg-[#f5f5f5] text-[#050505]"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#6c757d]">{draft.length}/5 selected</span>
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
            className="min-h-10 rounded-full border-0 bg-[#050505] px-5 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

type EditKey = "name" | "bio" | "work" | "school" | "nationality" | "languages" | "location" | "english_level";

function sectionFromParam(value: string | null): ProfileSection {
  return value === "connections" || value === "account" ? value : "edit";
}

export default function ProfileDashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shell = useProfileShellData();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [dialog, setDialog] = useState<EditKey | null>(null);
  const [showInterests, setShowInterests] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sectionParam = searchParams.get("section");
  const activeSection = sectionFromParam(sectionParam);
  const hasExplicitSection = sectionParam === "edit" || sectionParam === "connections" || sectionParam === "account";

  const navigateSection = (section: ProfileSection) => {
    router.replace(`/profile?section=${section}`, { scroll: false });
  };

  const closeMobilePanel = () => {
    router.replace("/profile", { scroll: false });
  };

  useEffect(() => {
    setAvatar(shell.currentUser?.photoURL ?? null);
  }, [shell.currentUser?.photoURL]);

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
    shell.setNotice("Profile updated.");
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
        return;
      }
      if (key === "nationality") return updateDetails({ nationality: value });
      if (key === "languages") {
        const languages = value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 6);
        return updateDetails({ languages });
      }
      if (key === "english_level") return updateDetails({ english_level: value });
      await updateBase({ [key]: value });
    } catch (saveError) {
      console.error("Profile update failed:", saveError);
      shell.setError("Unable to save this profile field. Please try again.");
      throw saveError;
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!shell.currentUser) return;
    if (file.size > 2 * 1024 * 1024) {
      shell.setError("Please choose an image under 2MB.");
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
      shell.setNotice("Profile photo updated.");
      await shell.refresh();
    } catch (uploadError) {
      console.error("Avatar upload failed:", uploadError);
      shell.setError("Unable to update your profile photo.");
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
      shell.setNotice("Profile photo removed.");
      await shell.refresh();
    } catch (removeError) {
      console.error("Avatar removal failed:", removeError);
      shell.setError("Unable to remove your profile photo.");
    } finally {
      setUploading(false);
    }
  };

  const saveInterests = async (items: string[]) => {
    try {
      await updateBase({ interests: items.join(", ") });
    } catch (saveError) {
      shell.setError("Unable to save interests.");
      throw saveError;
    }
  };

  const toggleVisibility = async () => {
    try {
      await updateBase({ profile_public: !shell.summary.profilePublic });
    } catch {
      shell.setError("Unable to update profile visibility.");
    }
  };

  const fieldValue = (key: EditKey) => {
    switch (key) {
      case "name": return shell.currentUser?.displayName || "";
      case "bio": return shell.summary.bio;
      case "work": return shell.summary.work;
      case "school": return shell.summary.school;
      case "nationality": return shell.summary.profileDetails.nationality || "";
      case "languages": return shell.summary.profileDetails.languages?.join(", ") || "";
      case "location": return shell.summary.location;
      case "english_level": return shell.summary.profileDetails.english_level || "";
    }
  };

  const dialogTitle: Record<EditKey, string> = {
    name: "Name",
    bio: "Bio",
    work: "Work",
    school: "Education",
    nationality: "Nationality",
    languages: "Languages",
    location: "Location",
    english_level: "English level",
  };

  const EditContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={mobile ? "px-4 pb-10 pt-5 sm:px-6" : "p-8"}>
      <div className="flex items-center justify-between gap-4">
        {mobile ? (
          <button type="button" onClick={closeMobilePanel} className="border-0 bg-transparent p-0 text-[28px] leading-none text-[#050505]" aria-label="Back to profile">‹</button>
        ) : null}
        <h1 className={`${mobile ? "mr-auto" : ""} m-0`}>Edit profile</h1>
        <button
          type="button"
          onClick={() => router.push(`/profile/${encodeURIComponent(shell.currentUser!.uid)}`)}
          className="border-0 bg-transparent p-0 text-[13px] font-semibold text-[#f47a4a]"
        >
          View public profile
        </button>
      </div>

      {mobile && (
        <button type="button" onClick={closeMobilePanel} className="mt-4 flex min-h-[52px] w-full items-center justify-between rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white px-4 py-3 text-[13px] font-semibold text-[#050505]">
          Profile strength <span className="text-[#f47a4a]">{shell.completion}% complete ›</span>
        </button>
      )}

      <section className="mt-7">
        <h2 className="m-0">Profile photo</h2>
        <p className="mt-1.5 text-[13px] text-[#6c757d]">One clear photo for meetup recognition — not a gallery.</p>
        <div className="mt-4 flex items-center gap-6 max-[520px]:gap-4">
          <div className="flex h-[132px] w-[132px] flex-none items-center justify-center overflow-hidden rounded-full bg-[#d1d1d1] text-[42px] font-extrabold text-white max-[520px]:h-[116px] max-[520px]:w-[116px] max-[520px]:text-[32px]">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials(shell.currentUser?.displayName)}
          </div>
          <div className="min-w-0">
            <p className="mb-4 text-[13px] text-[#6c757d] max-[520px]:hidden">Used across your profile and member directory.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="min-h-10 rounded-full border-0 bg-[#050505] px-4 text-[13px] font-semibold text-white disabled:opacity-60">
                {uploading ? "Working…" : "Replace photo"}
              </button>
              <button type="button" disabled={!avatar || uploading} onClick={() => void removeAvatar()} className="min-h-10 rounded-full border-[1.5px] border-[rgba(5,5,5,0.14)] bg-white px-4 text-[13px] font-semibold text-[#b42331] disabled:opacity-40">Remove</button>
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
        <h2 className="m-0">Interests</h2>
        <p className="mt-1.5 text-[13px] text-[#6c757d]">Choose up to 5 topics you enjoy talking about.</p>
        <button type="button" onClick={() => setShowInterests(true)} className="mt-4 flex min-h-[92px] w-full items-center justify-between rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white px-4 py-4 text-left">
          <div className="flex max-w-[500px] flex-wrap gap-2">
            {(selectedInterests.length ? selectedInterests : ["Add interests"]).map((interest, index) => (
              <span key={interest} className={`rounded-full px-3.5 py-2 text-[13px] font-semibold ${index === 0 && selectedInterests.length ? "border-[1.5px] border-[#050505] bg-[#f47a4a] text-[#050505]" : "bg-[#f5f5f5] text-[#050505]"}`}>{interest}</span>
            ))}
          </div>
          <span className="ml-3 text-[22px] text-[#6c757d]">›</span>
        </button>
      </section>

      <section className="mt-8">
        <h2 className="m-0">About You</h2>
        <div className="mt-4 overflow-hidden rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white px-4">
          <FieldRow icon="✎" label="Bio" value={shell.summary.bio} onClick={() => setDialog("bio")} />
          <FieldRow icon="▣" label="Work" value={shell.summary.work} onClick={() => setDialog("work")} />
          <FieldRow icon="◇" label="Education" value={shell.summary.school} onClick={() => setDialog("school")} />
          <FieldRow icon="◌" label="Nationality" value={shell.summary.profileDetails.nationality || ""} onClick={() => setDialog("nationality")} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="m-0">Language & Meetup</h2>
        <p className="mt-1.5 text-[13px] text-[#6c757d]">Community context instead of dating-style personal attributes.</p>
        <div className="mt-4 overflow-hidden rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white px-4">
          <FieldRow icon="◌" label="Languages" value={shell.summary.profileDetails.languages?.join(", ") || ""} onClick={() => setDialog("languages")} />
          <FieldRow icon="⌖" label="Location" value={shell.summary.location} onClick={() => setDialog("location")} />
          <FieldRow icon="A" label="English level" value={shell.summary.profileDetails.english_level || ""} onClick={() => setDialog("english_level")} />
          <FieldRow icon="◉" label="Profile visibility" value={shell.summary.profilePublic ? "Visible to members" : "Hidden"} onClick={() => void toggleVisibility()} />
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
      <ConnectionsPanel shell={shell} mobile onBack={closeMobilePanel} />
    ) : activeSection === "account" ? (
      <AccountMembershipPanel shell={shell} mobile onBack={closeMobilePanel} />
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
        displayNameOverride={shell.currentUser.displayName}
      >
        {desktopContent}
      </DesktopProfileShell>

      {hasExplicitSection ? (
        <main className="mx-auto min-h-[calc(100vh-68px)] w-full max-w-[640px] bg-transparent text-[#050505] lg:hidden">
          {mobileContent}
          {(shell.notice || shell.error) && activeSection !== "account" && (
            <div className={`mx-4 mb-6 rounded-[14px] border-[1.5px] border-[rgba(5,5,5,0.14)] px-4 py-3 text-[13px] font-semibold sm:mx-6 ${shell.error ? "bg-[#fff1f2] text-[#b42331]" : "bg-white text-[#050505]"}`}>
              {shell.error || shell.notice}
            </div>
          )}
        </main>
      ) : (
        <MobileProfileHub
          data={shell}
          avatarOverride={avatar}
          displayNameOverride={shell.currentUser.displayName}
          onEdit={() => navigateSection("edit")}
          onSectionChange={navigateSection}
        />
      )}

      {dialog && (
        <EditDialog
          title={dialogTitle[dialog]}
          value={fieldValue(dialog)}
          multiline={dialog === "bio"}
          options={dialog === "english_level" ? ENGLISH_LEVELS : undefined}
          onClose={() => setDialog(null)}
          onSave={(value) => saveDialogValue(dialog, value)}
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
