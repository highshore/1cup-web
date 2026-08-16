import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "../../../firebase/firebase";

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

  const storageRef = ref(storage, `marketing/${fileName(file.name)}`);
  const uploaded = await uploadBytes(storageRef, file);
  return getDownloadURL(uploaded.ref);
};
