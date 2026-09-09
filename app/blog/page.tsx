import type { Metadata } from "next";

import { BlogClient } from "./BlogClient";
import { fetchPublishedBlogPostsServer } from "../lib/features/blog/services/blog_service_server";
import { BlogPost } from "../lib/features/blog/types/blog_types";
import { SITE_NAME } from "../lib/seo/site";

export const metadata: Metadata = {
  title: `블로그 | ${SITE_NAME}`,
  description: "영어 학습과 시사·비즈니스·테크 토론에 도움이 되는 영어 한잔의 글을 만나보세요.",
  keywords: ["영어 학습", "영어 토론", "비즈니스 영어", "영어 한잔"],
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: `블로그 | ${SITE_NAME}`,
    description: "영어 학습과 시사·비즈니스·테크 토론에 도움이 되는 영어 한잔의 글을 만나보세요.",
    type: "website",
    url: "/blog",
  },
};

export default async function BlogPage() {
  let initialPosts: BlogPost[] = [];

  try {
    initialPosts = await fetchPublishedBlogPostsServer();
  } catch (error) {
    console.error("Error fetching blog posts at build time:", error);
    initialPosts = [];
  }

  return <BlogClient initialPosts={initialPosts} />;
}
