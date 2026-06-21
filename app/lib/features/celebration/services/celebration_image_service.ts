import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../../../firebase/firebase";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const generateUniqueFilename = (originalName: string): string => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split(".").pop() || "jpg";
  return `${timestamp}_${randomId}.${extension}`;
};

// Upload a celebration logo/image to Firebase Storage under `celebrations/`.
export const uploadCelebrationImage = async (file: File): Promise<string> => {
  try {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Only JPEG, PNG, and WebP images are allowed");
    }
    if (file.size > MAX_SIZE) {
      throw new Error("Image size must be less than 5MB");
    }

    const filename = generateUniqueFilename(file.name);
    const storageRef = ref(storage, `celebrations/${filename}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.error("Error uploading celebration image:", error);
    throw error;
  }
};

// Delete a previously uploaded celebration image. Best-effort: local/public
// asset paths (not Firebase Storage URLs) are ignored.
export const deleteCelebrationImage = async (
  imageUrl: string
): Promise<void> => {
  try {
    if (!imageUrl || !imageUrl.includes("firebasestorage")) return;

    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+)\?/);
    if (!pathMatch) return;

    const filePath = decodeURIComponent(pathMatch[1]);
    await deleteObject(ref(storage, filePath));
  } catch (error) {
    console.error("Error deleting celebration image:", error);
    // Non-fatal: deletion failures shouldn't block the admin action.
  }
};
