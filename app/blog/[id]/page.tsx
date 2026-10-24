import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import BlogDetailClient from "./BlogDetailClient";
import { resolvePublishedBlogPostRouteServer } from "../../lib/features/blog/services/blog_service_server";
import { getBlogRouteSlug, routeSlugEquals } from "../../lib/seo/route_slugs";

interface BlogDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

const SITE_URL = "https://1cupenglish.com";

// Force dynamic rendering - generate pages on-demand
export const dynamic = "force-dynamic";

function cleanDescription(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

async function resolvePost(routeValue: string) {
  return resolvePublishedBlogPostRouteServer(decodeURIComponent(routeValue || "").trim());
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { id } = await params;
  const routeValue = decodeURIComponent(id || "").trim();
  const post = await resolvePublishedBlogPostRouteServer(routeValue);

  if (!post) notFound();

  const canonicalSlug = getBlogRouteSlug(post);
  if (!routeSlugEquals(routeValue, canonicalSlug)) {
    permanentRedirect(`/blog/${encodeURIComponent(canonicalSlug)}`);
  }

  const canonicalUrl = `${SITE_URL}/blog/${encodeURIComponent(canonicalSlug)}`;
  const description = cleanDescription(post.excerpt || post.content);
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt?.toISOString(),
    author: {
      "@type": "Organization",
      name: "1 Cup English",
      alternateName: "영어 한잔",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "1 Cup English",
      alternateName: "영어 한잔",
      url: SITE_URL,
    },
    ...(post.featuredImage ? { image: [post.featuredImage] } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <BlogDetailClient initialPost={post} />
    </>
  );
}

// Generate metadata for SEO and GEO.
export async function generateMetadata({
  params,
}: BlogDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const routeValue = decodeURIComponent(id || "").trim();
    const post = await resolvePost(routeValue);

    if (post) {
      const canonicalSlug = getBlogRouteSlug(post);
      const canonicalPath = `/blog/${encodeURIComponent(canonicalSlug)}`;
      const description = cleanDescription(post.excerpt || post.content);

      return {
        title: `${post.title} | 영어 한잔`,
        description,
        keywords: post.tags?.length
          ? post.tags
          : ["영어 한잔", "1 Cup English", "Seoul English community"],
        alternates: { canonical: canonicalPath },
        openGraph: {
          title: post.title,
          description,
          type: "article",
          url: canonicalPath,
          publishedTime: post.publishedAt?.toISOString(),
          modifiedTime: post.updatedAt?.toISOString(),
          authors: ["1 Cup English"],
          images: post.featuredImage ? [post.featuredImage] : undefined,
        },
      };
    }

    return {
      title: "블로그 | 영어 한잔",
      description: "영어 한잔 커뮤니티의 블로그 콘텐츠를 만나보세요.",
      robots: { index: false, follow: false },
    };
  } catch (error) {
    console.error("Error generating metadata for blog post:", error);
    return {
      title: "블로그 | 영어 한잔",
      robots: { index: false, follow: false },
    };
  }
}
