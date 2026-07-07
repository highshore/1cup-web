import { supabase } from "../../../supabase/client";
import { BlogPost } from "../types/blog_types";

const TABLE_NAME = "blog_posts";

// Create a slug from title
const createSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .trim();
};

// Convert a Supabase row (snake_case) to a BlogPost.
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
    // likedBy is no longer stored inline; the junction table blog_post_likes
    // holds likes. Kept here (empty) so the BlogPost shape is unchanged.
    likedBy: [],
  };
};

// Fetch all published blog posts (for public view)
export const fetchBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    const { data, error } = await supabase
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
    console.error("Error fetching blog posts:", error);
    // Return empty array instead of throwing error if collection doesn't exist
    return [];
  }
};

// Fetch all blog posts (for admin view)
export const fetchAllBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    // Get all rows and sort in memory to match previous behaviour.
    const { data, error } = await supabase.from(TABLE_NAME).select("*");
    if (error) throw error;

    const posts = (data || [])
      .map(rowToBlogPost)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return posts;
  } catch (error) {
    console.error("Error fetching all blog posts:", error);
    // Return empty array instead of throwing error if collection doesn't exist
    return [];
  }
};

// Fetch a single blog post by ID (for admin use - returns any status)
export const fetchBlogPost = async (id: string): Promise<BlogPost | null> => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;

    return data ? rowToBlogPost(data) : null;
  } catch (error) {
    console.error("Error fetching blog post:", error);
    throw new Error("Failed to fetch blog post");
  }
};

// Fetch a single published blog post by ID (for public use - only published posts)
export const fetchPublishedBlogPost = async (
  id: string
): Promise<BlogPost | null> => {
  try {
    const { data, error } = await supabase
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
      return null; // Post exists but is not published
    }
    return null;
  } catch (error) {
    console.error("Error fetching published blog post:", error);
    throw new Error("Failed to fetch blog post");
  }
};

// Fetch a single blog post by slug (for admin use - returns any status)
export const fetchBlogPostBySlug = async (
  slug: string
): Promise<BlogPost | null> => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;

    return data ? rowToBlogPost(data) : null;
  } catch (error) {
    console.error("Error fetching blog post by slug:", error);
    throw new Error("Failed to fetch blog post");
  }
};

// Fetch a single published blog post by slug (for public use - only published posts)
export const fetchPublishedBlogPostBySlug = async (
  slug: string
): Promise<BlogPost | null> => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;

    return data ? rowToBlogPost(data) : null;
  } catch (error) {
    console.error("Error fetching published blog post by slug:", error);
    throw new Error("Failed to fetch blog post");
  }
};

// Create a new blog post
export const createBlogPost = async (
  postData: Partial<BlogPost>
): Promise<string> => {
  try {
    console.log("Creating blog post with data:", postData);

    const now = new Date().toISOString();
    // blog_posts.id is TEXT (was a Firestore doc id) — generate one.
    const id = crypto.randomUUID();
    let slug = createSlug(postData.title || "");
    // slug is UNIQUE in Postgres. A blank slug (e.g. title with no ascii chars)
    // or a collision would violate the constraint, so make it unique/non-empty.
    if (!slug) {
      slug = id;
    } else {
      const { data: existing } = await supabase
        .from(TABLE_NAME)
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (existing) {
        slug = `${slug}-${id.slice(0, 8)}`;
      }
    }

    const blogPost: any = {
      id,
      title: postData.title || "",
      content: postData.content || "",
      created_at: now,
      updated_at: now,
      published_at: postData.status === "published" ? now : null,
      status: postData.status || "draft",
      slug,
    };

    // Only include optional fields if they have values
    if (postData.excerpt) {
      blogPost.excerpt = postData.excerpt;
    }

    if (postData.featuredImage) {
      blogPost.featured_image = postData.featuredImage;
    }

    if (postData.tags && postData.tags.length > 0) {
      blogPost.tags = postData.tags;
    }

    if (postData.featured !== undefined) {
      blogPost.featured = !!postData.featured;
    }

    if (postData.category) {
      blogPost.category = postData.category;
    }

    console.log("Final blog post object:", blogPost);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(blogPost)
      .select()
      .single();
    if (error) throw error;

    console.log("Blog post created successfully with ID:", data.id);
    return data.id;
  } catch (error) {
    console.error("Error creating blog post:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack"
    );
    throw new Error(
      "Failed to create blog post: " +
        (error instanceof Error ? error.message : String(error))
    );
  }
};

// Update an existing blog post
export const updateBlogPost = async (
  id: string,
  postData: Partial<BlogPost>
): Promise<void> => {
  try {
    console.log("Updating blog post ID:", id, "with data:", postData);

    const now = new Date().toISOString();

    // Build update data without undefined values
    const updateData: any = {
      updated_at: now,
    };

    // Only include fields that have values to avoid undefined errors
    if (postData.title !== undefined) {
      updateData.title = postData.title;
      updateData.slug = createSlug(postData.title);
    }

    if (postData.content !== undefined) {
      updateData.content = postData.content;
    }

    if (postData.excerpt !== undefined) {
      updateData.excerpt = postData.excerpt;
    }

    if (postData.status !== undefined) {
      updateData.status = postData.status;
    }

    if (postData.featuredImage !== undefined) {
      updateData.featured_image = postData.featuredImage;
    }

    if (postData.tags !== undefined) {
      updateData.tags = postData.tags;
    }

    if (postData.featured !== undefined) {
      updateData.featured = !!postData.featured;
    }

    if (postData.category !== undefined) {
      updateData.category = postData.category;
    }

    // If publishing for the first time, set published_at
    if (postData.status === "published") {
      const { data: current } = await supabase
        .from(TABLE_NAME)
        .select("published_at")
        .eq("id", id)
        .maybeSingle();

      if (!current?.published_at) {
        updateData.published_at = now;
      }
    }

    console.log("Final update data:", updateData);
    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq("id", id);
    if (error) throw error;
    console.log("Blog post updated successfully");
  } catch (error) {
    console.error("Error updating blog post:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack"
    );
    throw new Error(
      "Failed to update blog post: " +
        (error instanceof Error ? error.message : String(error))
    );
  }
};

// Delete a blog post
export const deleteBlogPost = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting blog post:", error);
    throw new Error("Failed to delete blog post");
  }
};

// Fix missing slugs for existing blog posts
export const fixMissingSlugs = async (): Promise<void> => {
  try {
    console.log("Checking for blog posts with missing slugs...");
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("id, title, slug");
    if (error) throw error;

    const postsToUpdate: { id: string; title: string }[] = [];

    (data || []).forEach((row: any) => {
      if (!row.slug && row.title) {
        postsToUpdate.push({ id: row.id, title: row.title });
      }
    });

    if (postsToUpdate.length === 0) {
      console.log("All blog posts already have slugs");
      return;
    }

    console.log(
      `Found ${postsToUpdate.length} posts without slugs, updating...`
    );

    for (const post of postsToUpdate) {
      const slug = createSlug(post.title);
      const { error: updateError } = await supabase
        .from(TABLE_NAME)
        .update({ slug })
        .eq("id", post.id);
      if (updateError) throw updateError;
      console.log(`Updated post "${post.title}" with slug: ${slug}`);
    }

    console.log("Finished updating blog post slugs");
  } catch (error) {
    console.error("Error fixing missing slugs:", error);
    throw new Error("Failed to fix missing slugs");
  }
};

// --- Blog likes (junction table blog_post_likes) ------------------------------
// The old inline `likedBy[]` array is replaced by the blog_post_likes junction.

// Whether the given user has liked the given post.
export const hasLikedBlogPost = async (
  postId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("blog_post_likes")
      .select("user_id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error("Error checking blog post like:", error);
    return false;
  }
};

// Number of likes for a post (counted from the junction table).
export const getBlogPostLikeCount = async (postId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from("blog_post_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error("Error counting blog post likes:", error);
    return 0;
  }
};

// Like a post: insert a junction row (idempotent via upsert).
export const likeBlogPost = async (
  postId: string,
  userId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("blog_post_likes")
      .upsert({ post_id: postId, user_id: userId });
    if (error) throw error;
  } catch (error) {
    console.error("Error liking blog post:", error);
    throw new Error("Failed to like blog post");
  }
};

// Unlike a post: delete the junction row.
export const unlikeBlogPost = async (
  postId: string,
  userId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("blog_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
  } catch (error) {
    console.error("Error unliking blog post:", error);
    throw new Error("Failed to unlike blog post");
  }
};
