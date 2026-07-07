import { cache } from "react";

import { admin } from "../../../supabase/server";
import { BlogPost } from "../types/blog_types";

const TABLE_NAME = "blog_posts";

// Convert a Supabase row (snake_case) to a BlogPost for server-side.
const rowToBlogPost = (data: any): BlogPost => {
  return {
    id: data.id,
    title: data.title || "",
    content: data.content || "",
    excerpt: data.excerpt || "",
    createdAt: data.created_at ? new Date(data.created_at) : new Date(),
    updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
    publishedAt: data.published_at ? new Date(data.published_at) : null,
    status: data.status || "draft",
    slug: data.slug || "",
    featuredImage: data.featured_image || "",
    tags: data.tags || [],
    featured: data.featured ?? false,
    category: data.category || undefined,
    views: data.views || 0,
    likes: data.likes || 0,
    // likedBy now lives in the blog_post_likes junction table.
    likedBy: [],
  };
};

// Fetch all published blog posts (for SSG)
export const fetchPublishedBlogPostsServer = cache(async (): Promise<BlogPost[]> => {
  try {
    const { data, error } = await admin()
      .from(TABLE_NAME)
      .select("*")
      .eq("status", "published");
    if (error) throw error;

    const posts = (data || []).map(rowToBlogPost).sort((a, b) => {
      const dateA = a.publishedAt || a.createdAt;
      const dateB = b.publishedAt || b.createdAt;
      return dateB.getTime() - dateA.getTime();
    });

    return posts;
  } catch (error) {
    console.error("Error fetching published blog posts on server:", error);
    return [];
  }
});

// Fetch a single published blog post by ID (for SSG/SSR)
export const fetchPublishedBlogPostByIdServer = cache(async (
  id: string
): Promise<BlogPost | null> => {
  try {
    const { data, error } = await admin()
      .from(TABLE_NAME)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;

    if (data) {
      const post = rowToBlogPost(data);
      // Only return if the post is published
      if (post.status === "published") {
        return post;
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching published blog post by ID on server:", error);
    return null;
  }
});

// Get all published blog post IDs (for getStaticPaths)
export const getPublishedBlogPostIdsServer = cache(async (): Promise<string[]> => {
  try {
    const { data, error } = await admin()
      .from(TABLE_NAME)
      .select("id")
      .eq("status", "published");
    if (error) throw error;

    return (data || []).map((row: any) => row.id as string);
  } catch (error) {
    console.error("Error fetching blog post IDs on server:", error);
    return [];
  }
});
