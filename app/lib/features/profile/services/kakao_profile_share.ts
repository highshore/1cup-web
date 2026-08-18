type KakaoShare = {
  isInitialized?: () => boolean;
  init?: (key: string) => void;
  Share?: {
    sendDefault?: (payload: Record<string, unknown>) => void;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoShare;
  }
}

function loadKakaoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Kakao sharing is only available in a browser."));
      return;
    }
    if (window.Kakao) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://developers.kakao.com/sdk/js/kakao.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Kakao.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://developers.kakao.com/sdk/js/kakao.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Kakao."));
    document.head.appendChild(script);
  });
}

export async function shareMatchedProfileViaKakao({
  uid,
  displayName,
  locale,
}: {
  uid: string;
  displayName: string;
  locale: "en" | "ko";
}): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  if (!key || typeof window === "undefined") return false;

  await loadKakaoSdk();
  const Kakao = window.Kakao;
  if (!Kakao?.isInitialized?.()) Kakao?.init?.(key);
  if (!Kakao?.Share?.sendDefault) return false;

  const url = `https://1cupenglish.com/profile/${encodeURIComponent(uid)}`;
  const title = locale === "ko" ? `${displayName}님과 연결되었어요` : `You connected with ${displayName}`;
  const description = locale === "ko"
    ? "영어 한잔에서 서로 좋아요를 눌러 친구가 되었어요. 카카오톡에서 계속 이야기해 보세요!"
    : "You mutually connected on One Cup English. Keep the conversation going on KakaoTalk!";

  Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title,
      description,
      imageUrl: "https://1cupenglish.com/images/logos/1cup_logo.jpg",
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [
      {
        title: locale === "ko" ? "프로필 보기" : "View profile",
        link: { mobileWebUrl: url, webUrl: url },
      },
    ],
  });
  return true;
}
