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

// Instagram's content publishing API accepts only JPEG, so PNG and WebP uploads are
// re-encoded once here (transparent areas become white). Gopas and Threads accept
// JPEG too, so every marketing photo works on every channel.
const toJpeg = async (file: File): Promise<File> => {
  if (file.type === "image/jpeg" || file.type === "image/jpg") return file;
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to convert the image to JPEG.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("Unable to convert the image to JPEG.");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
};

export const uploadMarketingImage = async (original: File): Promise<string> => {
  if (!ALLOWED_TYPES.includes(original.type)) {
    throw new Error("Only JPG, PNG, and WebP images are supported.");
  }
  if (original.size > MAX_SIZE) {
    throw new Error("Images must be 5 MB or smaller.");
  }
  const file = await toJpeg(original);

  const path = `marketing/${fileName(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
};
