// Marketing photo uploads. Goes to the Supabase `assets` bucket, like every other
// app-side upload (blog, celebrations, admin article images); only the article
// pipeline still writes to Firebase Storage.
import { supabase } from "../../../supabase/client";

const BUCKET = "assets";
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

const fileName = (originalName: string) => {
  const extension = originalName.split(".").pop()?.toLowerCase() || "jpg";
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`;
};

export const uploadMarketingImage = async (file: File): Promise<string> => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only JPG, PNG, and WebP images are supported.");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("Images must be 5 MB or smaller.");
  }

  const path = `marketing/${fileName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
};
