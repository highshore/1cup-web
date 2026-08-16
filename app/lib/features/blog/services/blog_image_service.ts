import { supabase } from "../../../supabase/client";

const BUCKET = "assets";

// Generate unique filename for uploaded blog images
const generateUniqueFilename = (originalName: string): string => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split(".").pop() || "jpg";
  return `${timestamp}_${randomId}.${extension}`;
};

// Upload a single image to Supabase Storage for blog posts
export const uploadBlogImage = async (file: File): Promise<string> => {
  try {
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Only JPEG, PNG, and WebP images are allowed");
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error("Image size must be less than 5MB");
    }

    // Generate unique filename and upload under the blog/ prefix.
    const filename = generateUniqueFilename(file.name);
    const path = `blog/${filename}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true });
    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);

    console.log("Blog image uploaded successfully:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Error uploading blog image:", error);
    throw error;
  }
};

// Upload multiple images for blog posts
export const uploadBlogImages = async (files: File[]): Promise<string[]> => {
  try {
    const uploadPromises = files.map(async (file) => {
      return uploadBlogImage(file);
    });

    const downloadURLs = await Promise.all(uploadPromises);
    return downloadURLs;
  } catch (error) {
    console.error("Error uploading multiple blog images:", error);
    throw error;
  }
};

// Delete a blog image from Supabase Storage
export const deleteBlogImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract the storage path from the public URL.
    // Public URLs look like: .../storage/v1/object/public/assets/blog/<file>
    const marker = `/object/public/${BUCKET}/`;
    const idx = imageUrl.indexOf(marker);
    if (idx === -1) {
      throw new Error("Invalid Supabase Storage URL");
    }

    const filePath = decodeURIComponent(
      imageUrl.substring(idx + marker.length)
    );

    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) throw error;
    console.log("Blog image deleted successfully:", imageUrl);
  } catch (error) {
    console.error("Error deleting blog image:", error);
    throw error;
  }
};

// Utility function to validate blog image files
export const validateBlogImageFiles = (
  files: FileList | File[]
): { valid: File[]; errors: string[] } => {
  const valid: File[] = [];
  const errors: string[] = [];

  const fileArray = Array.from(files);
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const maxSize = 5 * 1024 * 1024; // 5MB

  fileArray.forEach((file, index) => {
    if (!allowedTypes.includes(file.type)) {
      errors.push(
        `File ${index + 1}: Only JPEG, PNG, and WebP images are allowed`
      );
      return;
    }

    if (file.size > maxSize) {
      errors.push(`File ${index + 1}: Image size must be less than 5MB`);
      return;
    }

    valid.push(file);
  });

  return { valid, errors };
};
