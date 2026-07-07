import { supabase } from "../../../supabase/client";

const generateUniqueFilename = (originalName: string): string => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  const extension = originalName.split(".").pop() || "jpg";
  return `${timestamp}_${randomId}.${extension}`;
};

export const uploadArticleImage = async (file: File): Promise<string> => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("지원되는 확장자는 JPG, PNG, WebP 입니다.");
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error("이미지 크기는 5MB 이하만 가능합니다.");
  }

  const filename = generateUniqueFilename(file.name);
  const path = `articles/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("assets")
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("assets").getPublicUrl(path);
  return publicUrl;
};

export const validateArticleImageFiles = (
  files: FileList | File[]
): { valid: File[]; errors: string[] } => {
  const valid: File[] = [];
  const errors: string[] = [];
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const maxSize = 5 * 1024 * 1024;

  Array.from(files).forEach((file, index) => {
    if (!allowedTypes.includes(file.type)) {
      errors.push(
        `파일 ${index + 1}: JPG, PNG, WebP 형식만 업로드할 수 있습니다.`
      );
      return;
    }

    if (file.size > maxSize) {
      errors.push(`파일 ${index + 1}: 5MB 이하의 이미지만 허용됩니다.`);
      return;
    }

    valid.push(file);
  });

  return { valid, errors };
};
