import type { Metadata } from "next";

import { BlogClient } from "./BlogClient";
import { fetchPublishedBlogPostsServer } from "../lib/features/blog/services/blog_service_server";
import { BlogPost } from "../lib/features/blog/types/blog_types";

// This page will be statically generated at build time
export default async function BlogPage() {
  let initialPosts: BlogPost[] = [];

  try {
    initialPosts = await fetchPublishedBlogPostsServer();
  } catch (error) {
    console.error("Error fetching blog posts at build time:", error);
    initialPosts = [];
  }

  return (
    <>
      <section className="sr-only" aria-label="1 Cup English blog overview">
        <h1>1 Cup English 영어 한잔 블로그</h1>
        <p>
          서울 영어 토론 커뮤니티 1 Cup English가 영어 학습, 커뮤니케이션,
          시사 토론, 기술과 커리어에 관한 글과 커뮤니티 소식을 공유합니다.
        </p>
      </section>
      <BlogClient initialPosts={initialPosts} />
    </>
  );
}

export const metadata: Metadata = {
  title: "영어 학습과 토론 블로그 | 1 Cup English 영어 한잔",
  description:
    "서울 영어 토론 커뮤니티 1 Cup English의 블로그입니다. 영어 학습, 커뮤니케이션, 시사 토론, 기술, 커리어와 커뮤니티 소식을 다룹니다.",
  keywords: [
    "영어 학습",
    "영어 토론",
    "서울 영어 커뮤니티",
    "English discussion Seoul",
    "1 Cup English",
    "영어 한잔",
  ],
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "1 Cup English 영어 한잔 블로그",
    description:
      "영어 학습, 커뮤니케이션, 시사 토론, 기술, 커리어와 커뮤니티 소식을 다루는 1 Cup English 블로그입니다.",
    type: "website",
    url: "/blog",
  },
};
