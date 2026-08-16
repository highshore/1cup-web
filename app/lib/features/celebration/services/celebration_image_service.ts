import { supabase } from "../../../supabase/client";

const BUCKET = "assets";
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const generateUniqueFilename = (originalName: string): string => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split(".").pop() || "jpg";
  return `${timestamp}_${randomId}.${extension}`;
};

// Upload a celebration logo/image to Supabase Storage under `celebrations/`.
export const uploadCelebrationImage = async (file: File): Promise<string> => {
  try {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Only JPEG, PNG, and WebP images are allowed");
    }
    if (file.size > MAX_SIZE) {
      throw new Error("Image size must be less than 5MB");
    }

    const filename = generateUniqueFilename(file.name);
    const path = `celebrations/${filename}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true });
    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return publicUrl;
  } catch (error) {
    console.error("Error uploading celebration image:", error);
    throw error;
  }
};

// Delete a previously uploaded celebration image. Best-effort: local/public
// asset paths (not Supabase Storage URLs) are ignored.
export const deleteCelebrationImage = async (
  imageUrl: string
): Promise<void> => {
  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = imageUrl ? imageUrl.indexOf(marker) : -1;
    if (idx === -1) return;

    const filePath = decodeURIComponent(imageUrl.substring(idx + marker.length));
    await supabase.storage.from(BUCKET).remove([filePath]);
  } catch (error) {
    console.error("Error deleting celebration image:", error);
    // Non-fatal: deletion failures shouldn't block the admin action.
  }
};
