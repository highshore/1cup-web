import type { Metadata } from "next";
import { notFound } from "next/navigation";

import BlogDetailClient from "./BlogDetailClient";
import { fetchPublishedBlogPostByIdServer } from "../../lib/features/blog/services/blog_service_server";
import { BlogPost } from "../../lib/features/blog/types/blog_types";
import JsonLd from "../../lib/seo/json_ld";
import {
  absoluteUrl,
  ORGANIZATION_ID,
  SITE_NAME,
} from "../../lib/seo/site";

interface BlogDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";

const postDescription = (post: BlogPost) =>
  (post.excerpt || post.content)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { id } = await params;
  const post = await fetchPublishedBlogPostByIdServer(id);

  if (!post) notFound();

  const canonicalPath = `/blog/${encodeURIComponent(post.id)}`;
  const pageUrl = absoluteUrl(canonicalPath);
  const description = postDescription(post);
  const image = post.featuredImage
    ? absoluteUrl(post.featuredImage)
    : absoluteUrl("/images/url-share-thumbnail.jpg");

  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${pageUrl}#blog-posting`,
    headline: post.title,
    description,
    image: [image],
    datePublished: (post.publishedAt || post.createdAt).toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
    author: {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: SITE_NAME,
    },
    ...(post.tags?.length ? { keywords: post.tags.join(", ") } : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: SITE_NAME,
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "블로그",
        item: absoluteUrl("/blog"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: pageUrl,
      },
    ],
  };

  return (
    <>
      <JsonLd data={[blogPostingJsonLd, breadcrumbJsonLd]} />
      <BlogDetailClient initialPost={post} />
    </>
  );
}

export async function generateMetadata({
  params,
}: BlogDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchPublishedBlogPostByIdServer(id);

  if (!post) {
    return {
      title: `블로그 | ${SITE_NAME}`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalPath = `/blog/${encodeURIComponent(post.id)}`;
  const description = postDescription(post);
  const image = post.featuredImage || "/images/url-share-thumbnail.jpg";

  return {
    title: `${post.title} | ${SITE_NAME}`,
    description,
    keywords: post.tags?.length ? post.tags : ["영어 학습", "영어 한잔"],
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      url: canonicalPath,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [SITE_NAME],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [image],
    },
  };
}
