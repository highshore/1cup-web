import type { BlogPost } from "../features/blog/types/blog_types";
import type { MeetupEvent } from "../features/meetup/types/meetup_types";

/**
 * Build a URL-safe segment without dropping Korean or other Unicode letters.
 * This keeps human-readable titles intact while normalizing punctuation/spacing.
 */
export function slugifyRoutePart(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Blog URLs are based on the current post title.
 * Keep an existing title-based collision suffix when one already exists.
 */
export function getBlogRouteSlug(
  post: Pick<BlogPost, "id" | "title" | "slug">,
): string {
  const titleSlug = slugifyRoutePart(post.title);
  const storedSlug = (post.slug || "").trim();

  if (!titleSlug) return storedSlug || post.id;

  if (
    storedSlug &&
    storedSlug !== post.id &&
    (storedSlug === titleSlug || storedSlug.startsWith(`${titleSlug}-`))
  ) {
    return storedSlug;
  }

  return titleSlug;
}

const LOCATION_ALIASES: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /(안암|고려대|고려대학교)/i, slug: "Anam" },
  { pattern: /여의도/i, slug: "Yeouido" },
  { pattern: /성수/i, slug: "Seongsu" },
  { pattern: /(홍대|홍익대|홍익대학교)/i, slug: "Hongdae" },
  { pattern: /강남/i, slug: "Gangnam" },
];

export function getMeetupLocationSlug(
  event: Pick<MeetupEvent, "title" | "location_name" | "location_address">,
): string {
  const searchable = [event.title, event.location_name, event.location_address]
    .filter(Boolean)
    .join(" ");

  const alias = LOCATION_ALIASES.find(({ pattern }) => pattern.test(searchable));
  if (alias) return alias.slug;

  return slugifyRoutePart(event.location_name || event.title) || "Seoul";
}

/**
 * Public meetup URLs follow YYYY-MM-DD-Location, e.g. 2026-09-17-Anam.
 */
export function getMeetupRouteSlug(
  event: Pick<MeetupEvent, "date" | "title" | "location_name" | "location_address">,
): string {
  return `${event.date}-${getMeetupLocationSlug(event)}`;
}

export function routeSlugEquals(left: string, right: string): boolean {
  return decodeURIComponent(left).trim().toLocaleLowerCase("en-US") ===
    decodeURIComponent(right).trim().toLocaleLowerCase("en-US");
}
