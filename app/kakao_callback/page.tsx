"use client";

// Obsolete under Supabase native Kakao OAuth: Kakao now returns to Supabase's
// /auth/v1/callback, which redirects to /auth. This route only remains to catch
// any stale links/bookmarks and forward them to the login page.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KakaoCallback() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/auth");
  }, [router]);
  return null;
}
