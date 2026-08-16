import { supabase } from "../../../supabase/client";

const STORAGE_BUCKET = "assets";

// Generate unique filename for uploaded images
const generateUniqueFilename = (originalName: string): string => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split(".").pop() || "jpg";
  return `${timestamp}_${randomId}.${extension}`;
};

// Upload a single image to Supabase Storage
export const uploadMeetupImage = async (file: File): Promise<string> => {
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

    // Generate unique filename
    const filename = generateUniqueFilename(file.name);
    const path = `meetup/${filename}`;

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const downloadURL = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path).data.publicUrl;

    console.log("Image uploaded successfully:", downloadURL);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
};

// Upload multiple images
export const uploadMeetupImages = async (files: File[]): Promise<string[]> => {
  try {
    const uploadPromises = files.map(async (file) => {
      return uploadMeetupImage(file);
    });

    const downloadURLs = await Promise.all(uploadPromises);
    return downloadURLs;
  } catch (error) {
    console.error("Error uploading multiple images:", error);
    throw error;
  }
};

// Delete an image from Supabase Storage
export const deleteMeetupImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract the object path from the public URL:
    //   .../storage/v1/object/public/assets/<path>
    const url = new URL(imageUrl);
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      throw new Error("Invalid Supabase Storage URL");
    }

    const filePath = decodeURIComponent(
      url.pathname.substring(markerIndex + marker.length)
    );

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      throw error;
    }

    console.log("Image deleted successfully:", imageUrl);
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};

// Utility function to validate image files
export const validateImageFiles = (
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
