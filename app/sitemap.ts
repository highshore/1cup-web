import type { MetadataRoute } from "next";

import { fetchPublishedBlogPostsServer } from "./lib/features/blog/services/blog_service_server";
import { fetchMeetupEventsPageServer } from "./lib/features/meetup/services/meetup_public_server";
import type { MeetupEvent } from "./lib/features/meetup/types/meetup_types";
import { getBlogRouteSlug, getMeetupRouteSlug } from "./lib/seo/route_slugs";

const SITE_URL = "https://1cupenglish.com";
const PAGE_SIZE = 50;
const MAX_MEETUPS = 500;

export const dynamic = "force-dynamic";

async function getMeetupsForSitemap(): Promise<MeetupEvent[]> {
  const events: MeetupEvent[] = [];
  let offset = 0;

  while (offset < MAX_MEETUPS) {
    const page = await fetchMeetupEventsPageServer(offset, PAGE_SIZE);
    events.push(...page.events);
    if (page.lastDoc === null) break;
    offset = page.lastDoc;
  }

  return events;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/meetup`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/exam-center`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  try {
    const posts = await fetchPublishedBlogPostsServer();
    entries.push(
      ...posts.map((post) => ({
        url: `${SITE_URL}/blog/${encodeURIComponent(getBlogRouteSlug(post))}`,
        lastModified: post.updatedAt || post.publishedAt || post.createdAt,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    );
  } catch (error) {
    console.error("Unable to add blog posts to sitemap", error);
  }

  try {
    const meetups = await getMeetupsForSitemap();
    entries.push(
      ...meetups.map((event) => ({
        url: `${SITE_URL}/meetup/${encodeURIComponent(getMeetupRouteSlug(event))}`,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    );
  } catch (error) {
    console.error("Unable to add meetups to sitemap", error);
  }

  return entries;
}
