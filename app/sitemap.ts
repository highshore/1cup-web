import type { MetadataRoute } from "next";

import { fetchPublishedBlogPostsServer } from "./lib/features/blog/services/blog_service_server";
import { fetchMeetupSitemapRecordsServer } from "./lib/seo/content_server";
import { absoluteUrl } from "./lib/seo/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [blogPosts, meetups] = await Promise.all([
    fetchPublishedBlogPostsServer(),
    fetchMeetupSitemapRecordsServer(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/meetup"),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/blog"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/shadow"),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/non-korean-applicants"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/speaking-test"),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/guide"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/leaderboard"),
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: absoluteUrl("/cefr"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: absoluteUrl(`/blog/${encodeURIComponent(post.id)}`),
    lastModified: post.updatedAt || post.publishedAt || post.createdAt,
    changeFrequency: "monthly",
    priority: 0.6,
    ...(post.featuredImage
      ? { images: [absoluteUrl(post.featuredImage)] }
      : {}),
  }));

  const meetupPages: MetadataRoute.Sitemap = meetups.map((meetup) => ({
    url: absoluteUrl(`/meetup/${encodeURIComponent(meetup.id)}`),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...meetupPages, ...blogPages];
}
