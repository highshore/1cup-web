import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { BlogPost } from "../types/blog_types";

const COLLECTION_NAME = "blog_posts";

// Create a slug from title
const createSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .trim();
};

// Convert Firestore document to BlogPost
const docToBlogPost = (doc: any): BlogPost => {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || "",
    content: data.content || "",
    excerpt: data.excerpt || "",
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    publishedAt: data.publishedAt?.toDate() || null,
    status: data.status || "draft",
    slug: data.slug || "",
    featuredImage: data.featuredImage || "",
    tags: data.tags || [],
    featured: data.featured ?? false,
    category: data.category || undefined,
    views: data.views || 0,
    likes: data.likes || 0,
    likedBy: data.likedBy || [],
  };
};

// Fetch all published blog posts (for public view)
export const fetchBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    const blogRef = collection(db, COLLECTION_NAME);
    const publishedPostsQuery = query(blogRef, where("status", "==", "published"));
    const querySnapshot = await getDocs(publishedPostsQuery);
    const posts = querySnapshot.docs
      .map(docToBlogPost)
      .sort((a, b) => {
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
    const blogRef = collection(db, COLLECTION_NAME);

    // Get all documents and sort in memory to avoid index issues
    const querySnapshot = await getDocs(blogRef);
    const posts = querySnapshot.docs
      .map(docToBlogPost)
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
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docToBlogPost(docSnap);
    } else {
      return null;
    }
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
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const post = docToBlogPost(docSnap);
      // Only return if the post is published
      if (post.status === "published") {
        return post;
      } else {
        return null; // Post exists but is not published
      }
    } else {
      return null;
    }
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
    const blogRef = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(blogRef);

    const post = querySnapshot.docs
      .map(docToBlogPost)
      .find((post) => post.slug === slug);

    return post || null;
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
    const blogRef = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(blogRef);

    const post = querySnapshot.docs
      .map(docToBlogPost)
      .find((post) => post.slug === slug && post.status === "published");

    return post || null;
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

    const now = new Date();
    const slug = createSlug(postData.title || "");

    const blogPost: any = {
      title: postData.title || "",
      content: postData.content || "",
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      publishedAt:
        postData.status === "published" ? Timestamp.fromDate(now) : null,
      status: postData.status || "draft",
      slug: slug,
    };

    // Only include optional fields if they have values
    if (postData.excerpt) {
      blogPost.excerpt = postData.excerpt;
    }

    if (postData.featuredImage) {
      blogPost.featuredImage = postData.featuredImage;
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

    const blogRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(blogRef, blogPost);

    console.log("Blog post created successfully with ID:", docRef.id);
    return docRef.id;
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

    const docRef = doc(db, COLLECTION_NAME, id);
    const now = new Date();

    // Build update data without undefined values
    const updateData: any = {
      updatedAt: Timestamp.fromDate(now),
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
      updateData.featuredImage = postData.featuredImage;
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

    // If publishing for the first time, set publishedAt
    if (postData.status === "published") {
      const currentDoc = await getDoc(docRef);
      const currentData = currentDoc.data();

      if (!currentData?.publishedAt) {
        updateData.publishedAt = Timestamp.fromDate(now);
      }
    }

    console.log("Final update data:", updateData);
    await updateDoc(docRef, updateData);
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
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting blog post:", error);
    throw new Error("Failed to delete blog post");
  }
};

// Fix missing slugs for existing blog posts
export const fixMissingSlugs = async (): Promise<void> => {
  try {
    console.log("Checking for blog posts with missing slugs...");
    const blogRef = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(blogRef);

    const postsToUpdate: { id: string; title: string }[] = [];

    querySnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!data.slug && data.title) {
        postsToUpdate.push({ id: doc.id, title: data.title });
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
      const docRef = doc(db, COLLECTION_NAME, post.id);
      await updateDoc(docRef, { slug });
      console.log(`Updated post "${post.title}" with slug: ${slug}`);
    }

    console.log("Finished updating blog post slugs");
  } catch (error) {
    console.error("Error fixing missing slugs:", error);
    throw new Error("Failed to fix missing slugs");
  }
};
