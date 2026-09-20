from pathlib import Path

paths = [
    'app/meetup/[id]/EventDetailClient.tsx',
    'app/profile/ProfileShell.tsx',
    'app/profile/ProfileClient.tsx',
    'app/lib/features/profile/services/kakao_profile_share.ts',
]
files = {path: Path(path).read_text() for path in paths}

def replace_once(path, old, new):
    count = files[path].count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one exact match, found {count}: {old[:100]!r}')
    files[path] = files[path].replace(old, new, 1)

p = paths[0]
replace_once(p, 'import "./event-detail.css";', '''import "./event-detail.css";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { SHARE_MESSAGE_LABELS } from "../../lib/i18n/share_message_labels";
import {
  SEATING_SHARE_MESSAGE,
  buildMeetupArticleMessage,
  buildTextShareData,
  copyShareText,
} from "../../lib/share_messages";''')
replace_once(p, 'export function EventDetailClient() {', '''export function EventDetailClient() {
  const { locale } = useI18n();
  const shareMessageLabels = SHARE_MESSAGE_LABELS[locale];''')
replace_once(p, '''        title: "영어한잔 좌석 배치",
        text: "안녕하세요! 오늘 영어 한잔 안암 커뮤니티 좌석배치 공유드립니다. 그럼 이따 뵙겠습니다!",''', '''        ...buildTextShareData(SEATING_SHARE_MESSAGE),''')
replace_once(p, '''    const shareText = `안녕하세요,

저희 밋업페이지에 아티클이 업데이트 되었습니다.
${meetupUrl}
*아티클은 로그인 하셔야 확인 가능합니다.

질문은 추후 변경될 수 있는점 참고하셔서 확인 부탁드립니다.

감사합니다!`;''', '''    const shareText = buildMeetupArticleMessage(meetupUrl);''')
replace_once(p, 'await navigator.share({ text: shareText });', 'await navigator.share(buildTextShareData(shareText));')
replace_once(p, '''      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        alert("아티클 안내 문구를 복사했습니다. 카카오톡에 붙여넣어 주세요.");
        return;
      }

      const textarea = document.createElement("textarea");
      textarea.value = shareText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();

      if (!copied) {
        throw new Error("클립보드 복사를 지원하지 않는 브라우저입니다.");
      }

      alert("아티클 안내 문구를 복사했습니다. 카카오톡에 붙여넣어 주세요.");''', '''      await copyShareText(shareText);
      alert(shareMessageLabels.copied);''')
replace_once(p, '  const handleShareArticleLink = async () => {', '''  // A separate plain-text copy path avoids formatting added by native share targets.
  // Keep the existing image/share-sheet workflow available; never send automatically.
  const handleCopyDefaultMessage = async (kind: "article" | "seating") => {
    if (!eventId) return;
    const text = kind === "seating"
      ? SEATING_SHARE_MESSAGE
      : buildMeetupArticleMessage(
          `https://1cupenglish.com/meetup/${encodeURIComponent(eventId)}`,
        );
    try {
      await copyShareText(text);
      alert(shareMessageLabels.copied);
    } catch (error) {
      console.error("Unable to copy the default share message:", error);
      alert(shareMessageLabels.copyFailed);
    }
  };

  const handleShareArticleLink = async () => {''')
old_button = '''              <AdminButton
                onClick={handleShareArticleLink}
                disabled={articleShareLoading}
              >
                <PaperAirplaneIcon />
                <span>
                  {articleShareLoading ? "Sharing..." : "Share Article via Kakao"}
                </span>
              </AdminButton>'''
replace_once(p, old_button, '''              <AdminButton
                onClick={() => handleCopyDefaultMessage("seating")}
                disabled={seatingAssignments.length === 0}
              >
                <DocumentDuplicateIcon />
                <span>{shareMessageLabels.copySeating}</span>
              </AdminButton>
''' + old_button + '''
              <AdminButton onClick={() => handleCopyDefaultMessage("article")}>
                <DocumentDuplicateIcon />
                <span>{shareMessageLabels.copyArticle}</span>
              </AdminButton>''')

p = paths[1]
replace_once(p, '"use client";\n', '''"use client";

import { buildReferralShareMessage, buildTextShareData, copyShareText, normalizeShareText } from "../lib/share_messages";
''')
replace_once(p, 'const title = t.profile.referralShareTitle;', 'const title = normalizeShareText(t.profile.referralShareTitle);')
replace_once(p, 'const codeLabel = interpolate(t.profile.referralCodeLabel, { code });', 'const codeLabel = normalizeShareText(interpolate(t.profile.referralCodeLabel, { code }));')
replace_once(p, 'const text = `${title}: ${code}\\n${url}`;', 'const text = buildReferralShareMessage(title, code, url);')
replace_once(p, 'await navigator.clipboard.writeText(text);', 'await copyShareText(text);')
replace_once(p, 'await navigator.share({ title: "1 Cup English", text, url });', 'await navigator.share(buildTextShareData(text));')

p = paths[2]
replace_once(p, '"use client";\n', '''"use client";

import { buildReferralShareMessage, copyShareText } from "../lib/share_messages";
''')
replace_once(p, 'const shareText = `영어 한잔 추천 코드: ${userData.referralCode}\\nhttps://1cupenglish.com/payment?ref=${userData.referralCode}`;', '''const shareText = buildReferralShareMessage(
      "영어 한잔 추천 코드",
      userData.referralCode,
      `https://1cupenglish.com/payment?ref=${userData.referralCode}`,
    );''')
replace_once(p, 'await navigator.clipboard.writeText(shareText);', 'await copyShareText(shareText);')

p = paths[3]
files[p] = 'import { normalizeShareText } from "../../../share_messages";\n\n' + files[p]
replace_once(p, '      title,\n      description,', '      title: normalizeShareText(title),\n      description: normalizeShareText(description),')

# All exact-match checks must pass before any existing source is overwritten.
for path, text in files.items():
    Path(path).write_text(text)
    print('Updated:', path)
