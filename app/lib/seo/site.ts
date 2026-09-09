export const SITE_URL = "https://1cupenglish.com";
export const SITE_NAME = "영어 한잔";
export const SITE_NAME_EN = "1 Cup English";
export const SITE_DESCRIPTION =
  "서울에서 시사·비즈니스·테크 주제를 영어로 깊이 있게 토론하는 오프라인 영어 커뮤니티.";
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}
