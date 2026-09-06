import React, { useState, useEffect, useRef } from "react";
import { colors } from "../../../constants/colors";
import { BlogPost } from "../types/blog_types";
import {
  uploadBlogImage,
  validateBlogImageFiles,
} from "../services/blog_image_service";
import { DocumentTextIcon, PhotoIcon } from "@heroicons/react/24/outline";

// Using shared colors (via Tailwind theme tokens)

const inputClasses =
  "w-full p-3 border border-line rounded text-[1rem] text-ink bg-white [transition:all_0.2s_ease] box-border [font-family:inherit] focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,102,0,0.1)] placeholder:text-ink-light max-[768px]:p-2.5 max-[768px]:text-[0.9rem]";

const selectClasses =
  "w-full p-3 border border-line rounded text-[1rem] text-ink bg-white [transition:all_0.2s_ease] box-border [font-family:inherit] focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,102,0,0.1)] max-[768px]:p-2.5 max-[768px]:text-[0.9rem]";

const labelClasses =
  "block mb-2 font-semibold text-ink text-[0.9rem] [font-family:inherit] max-[768px]:text-[0.85rem]";

const formGroupClasses = "mb-6 max-[768px]:mb-5";

const buttonBaseClasses =
  "px-6 py-3 rounded text-[0.9rem] font-semibold [font-family:inherit] cursor-pointer [transition:all_0.2s_ease] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed max-[768px]:px-6 max-[768px]:py-[0.875rem] max-[768px]:text-[0.85rem] max-[768px]:justify-center";

const primaryButtonClasses = `${buttonBaseClasses} border-none bg-accent text-white shadow-[0_2px_4px_rgba(0,0,0,0.1)] enabled:hover:bg-accent-hover enabled:hover:[transform:translateY(-1px)] enabled:hover:shadow-[0_4px_8px_rgba(0,0,0,0.1)]`;

const secondaryButtonClasses = `${buttonBaseClasses} bg-transparent text-ink-medium border border-line enabled:hover:bg-primary-pale enabled:hover:border-accent enabled:hover:text-accent`;

function HelpText({
  style,
  children,
}: {
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className="text-ink-light text-[0.85rem] mt-2 leading-[1.4]"
      style={style}
    >
      {children}
    </div>
  );
}

function ContentImageButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="px-3 py-2 bg-primary-pale text-ink border-none rounded-md text-[0.8rem] font-semibold cursor-pointer [transition:all_0.2s_ease] flex items-center gap-[0.375rem] [&_svg]:w-4 [&_svg]:h-4 hover:bg-accent hover:text-white disabled:opacity-60 disabled:cursor-not-allowed max-[768px]:px-[0.6rem] max-[768px]:py-[0.4rem] max-[768px]:text-[0.75rem]"
      {...rest}
    >
      {children}
    </button>
  );
}

function FormatButton({
  $active,
  children,
  ...rest
}: { $active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${
        $active
          ? "bg-accent text-white hover:bg-primary-light"
          : "bg-white text-ink hover:bg-primary-pale"
      } border border-line rounded-md px-[0.6rem] py-[0.4rem] text-[0.85rem] font-semibold [font-family:'Noto_Sans_KR',sans-serif] cursor-pointer [transition:all_0.2s_ease] flex items-center gap-[0.3rem] disabled:opacity-50 disabled:cursor-not-allowed max-[768px]:px-2 max-[768px]:py-[0.3rem] max-[768px]:text-[0.8rem]`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface BlogEditorProps {
  post: BlogPost | null;
  onSave: (postData: Partial<BlogPost>) => void;
  onCancel: () => void;
}

export const BlogEditor: React.FC<BlogEditorProps> = ({
  post,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
    status: "draft" as "draft" | "published",
    featuredImage: "",
    tags: "",
    featured: false,
    category: "info" as "announcement" | "review" | "info",
  });

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const featuredImageInputRef = useRef<HTMLInputElement>(null);
  const contentImageInputRef = useRef<HTMLInputElement>(null);

  // Initialize form data
  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title || "",
        content: post.content || "",
        excerpt: post.excerpt || "",
        status: (post.status as "draft" | "published") || "draft",
        featuredImage: post.featuredImage || "",
        tags: post.tags?.join(", ") || "",
        featured: !!post.featured,
        category:
          (post.category as "announcement" | "review" | "info") || "info",
      });
    }
  }, [post]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }

    if (!formData.content.trim()) {
      alert("내용을 입력해주세요.");
      return;
    }

    setSaving(true);

    try {
      const postData: Partial<BlogPost> = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        status: formData.status,
      };

      // Only include fields that have values; the database payload must not contain undefined.
      if (formData.excerpt.trim()) {
        postData.excerpt = formData.excerpt.trim();
      }

      if (formData.featuredImage.trim()) {
        postData.featuredImage = formData.featuredImage.trim();
      }

      if (formData.tags.trim()) {
        const tags = formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);
        if (tags.length > 0) {
          postData.tags = tags;
        }
      }

      postData.featured = !!formData.featured;
      postData.category = formData.category;

      console.log("Submitting blog post data:", postData);
      await onSave(postData);
    } catch (error) {
      console.error("Failed to save post:", error);
      alert("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleFeaturedImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { valid, errors } = validateBlogImageFiles(files);

    if (errors.length > 0) {
      alert("이미지 업로드 오류:\n" + errors.join("\n"));
      return;
    }

    if (valid.length === 0) return;

    try {
      setUploading(true);
      setUploadProgress("대표 이미지 업로드 중...");
      setUploadError(null);

      const imageUrl = await uploadBlogImage(valid[0]);

      setFormData((prev) => ({
        ...prev,
        featuredImage: imageUrl,
      }));

      setUploadProgress("");
    } catch (error) {
      console.error("Featured image upload failed:", error);
      setUploadError(
        "이미지 업로드에 실패했습니다: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setUploading(false);
      if (featuredImageInputRef.current) {
        featuredImageInputRef.current.value = "";
      }
    }
  };

  const handleContentImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { valid, errors } = validateBlogImageFiles(files);

    if (errors.length > 0) {
      alert("이미지 업로드 오류:\n" + errors.join("\n"));
      return;
    }

    if (valid.length === 0) return;

    try {
      setUploading(true);
      setUploadProgress("컨텐츠 이미지 업로드 중...");
      setUploadError(null);

      const imageUrl = await uploadBlogImage(valid[0]);

      // Insert image markdown at cursor position or end of content
      const imageMarkdown = `\n![이미지 설명](${imageUrl})\n`;
      const textarea = document.getElementById(
        "content"
      ) as HTMLTextAreaElement;

      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentContent = formData.content;

        const newContent =
          currentContent.substring(0, start) +
          imageMarkdown +
          currentContent.substring(end);

        setFormData((prev) => ({
          ...prev,
          content: newContent,
        }));

        // Focus back to textarea and set cursor position
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(
            start + imageMarkdown.length,
            start + imageMarkdown.length
          );
        }, 100);
      } else {
        // Fallback: append to end
        setFormData((prev) => ({
          ...prev,
          content: prev.content + imageMarkdown,
        }));
      }

      setUploadProgress("");
    } catch (error) {
      console.error("Content image upload failed:", error);
      setUploadError(
        "이미지 업로드에 실패했습니다: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setUploading(false);
      if (contentImageInputRef.current) {
        contentImageInputRef.current.value = "";
      }
    }
  };

  const handleRemoveFeaturedImage = () => {
    setFormData((prev) => ({
      ...prev,
      featuredImage: "",
    }));
  };

  const handleFeaturedImageButtonClick = () => {
    featuredImageInputRef.current?.click();
  };

  const handleContentImageButtonClick = () => {
    contentImageInputRef.current?.click();
  };

  const handleInsertHeader = () => {
    const textarea = document.getElementById("content") as HTMLTextAreaElement;

    if (textarea) {
      // Save current scroll position to prevent jumping
      const scrollTop = textarea.scrollTop;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentContent = formData.content;

      // Check if we're at the beginning of a line or add a new line
      const beforeCursor = currentContent.substring(0, start);
      const atLineStart = beforeCursor === "" || beforeCursor.endsWith("\n");
      const headerText = atLineStart ? "# " : "\n# ";

      const newContent =
        currentContent.substring(0, start) +
        headerText +
        currentContent.substring(end);

      setFormData((prev) => ({
        ...prev,
        content: newContent,
      }));

      // Focus back to textarea and set cursor position after the header
      setTimeout(() => {
        textarea.setSelectionRange(
          start + headerText.length,
          start + headerText.length
        );
        // Restore scroll position to prevent jumping to top
        textarea.scrollTop = scrollTop;
        textarea.focus();
      }, 50);
    }
  };

  const handleFormatText = (formatType: "bold" | "crimson") => {
    const textarea = document.getElementById("content") as HTMLTextAreaElement;

    if (textarea) {
      const scrollTop = textarea.scrollTop;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const originalContent = formData.content;

      // The segment of text that is actually selected by the user
      const selectedText = originalContent.substring(start, end);

      // Don't do anything if the selection is empty
      if (!selectedText) {
        return;
      }

      let formattedSelection = "";
      if (formatType === "bold") {
        // Make sure to format as **text** without any extra line breaks
        formattedSelection = `**${selectedText}**`;
      } else if (formatType === "crimson") {
        formattedSelection = `<span style="color: crimson; font-weight: bold;">${selectedText}</span>`;
      }

      const newContent =
        originalContent.substring(0, start) +
        formattedSelection +
        originalContent.substring(end);

      setFormData((prev) => ({
        ...prev,
        content: newContent,
      }));

      // Restore focus and cursor position - place cursor right after the formatted text
      setTimeout(() => {
        const newCursorPos = start + formattedSelection.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.scrollTop = scrollTop;
        textarea.focus();
      }, 50);
    }
  };

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[1000] p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-lg w-full max-w-[800px] max-h-[90vh] overflow-y-auto shadow-[0_20px_40px_rgba(0,0,0,0.15)] [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif] max-[768px]:max-h-[95vh] max-[768px]:rounded-md">
        <div className="py-6 px-8 border-b border-line bg-primary-pale rounded-t-lg max-[768px]:py-5 max-[768px]:px-6 max-[768px]:rounded-t-md">
          <h2 className="text-[1.5rem] font-semibold text-ink m-0 [font-family:inherit] max-[768px]:text-[1.25rem]">
            {post ? "포스트 편집" : "새 포스트 작성"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-8 max-[768px]:p-6">
          <div className={formGroupClasses}>
            <label htmlFor="title" className={labelClasses}>
              제목 *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              placeholder="블로그 포스트 제목을 입력하세요"
              required
              className={inputClasses}
            />
            <HelpText>제목은 100자 이내로 작성해주세요.</HelpText>
          </div>

          <div className={formGroupClasses}>
            <label htmlFor="excerpt" className={labelClasses}>
              요약
            </label>
            <input
              id="excerpt"
              name="excerpt"
              type="text"
              value={formData.excerpt}
              onChange={handleChange}
              placeholder="포스트의 간단한 요약을 작성하세요 (선택사항)"
              className={inputClasses}
            />
            <HelpText>요약은 300자 이내로 작성해주세요.</HelpText>
          </div>

          <div className={formGroupClasses}>
            <label htmlFor="content" className={labelClasses}>
              내용 *
            </label>
            <div className="flex gap-2 mb-2 flex-wrap max-[768px]:gap-[0.375rem]">
              <ContentImageButton
                type="button"
                onClick={handleInsertHeader}
                disabled={uploading}
              >
                <DocumentTextIcon />
                헤더 삽입
              </ContentImageButton>
              <ContentImageButton
                type="button"
                onClick={handleContentImageButtonClick}
                disabled={uploading}
              >
                <PhotoIcon />
                이미지 삽입
              </ContentImageButton>
              <HelpText style={{ margin: 0, fontSize: "0.75rem" }}>
                헤더는 '# ' 형식으로, 이미지는 마크다운 형식으로 커서 위치에
                삽입됩니다
              </HelpText>
            </div>
            <div className="flex gap-2 items-center mb-2 flex-wrap p-2 bg-primary-bg rounded-lg max-[768px]:gap-[0.4rem] max-[768px]:p-[0.4rem]">
              <FormatButton
                type="button"
                onClick={() => handleFormatText("bold")}
                disabled={uploading}
                title="굵은 텍스트"
              >
                <strong>B</strong>
                굵게
              </FormatButton>
              <FormatButton
                type="button"
                onClick={() => handleFormatText("crimson")}
                disabled={uploading}
                title="빨간 굵은 텍스트"
                style={{ color: "crimson" }}
              >
                <strong style={{ color: "crimson" }}>A</strong>
                빨간색
              </FormatButton>
              <HelpText style={{ margin: 0, fontSize: "0.75rem" }}>
                텍스트를 선택한 후 버튼을 클릭하거나, 버튼을 클릭하여 서식을
                삽입하세요
              </HelpText>
            </div>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              placeholder="여기에 블로그 포스트 내용을 작성하세요..."
              required
              className="w-full min-h-[300px] p-4 border border-line rounded text-[1rem] text-ink bg-white [transition:all_0.2s_ease] resize-y [font-family:inherit] leading-[1.6] box-border focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,102,0,0.1)] placeholder:text-ink-light max-[768px]:p-[0.875rem] max-[768px]:text-[0.9rem] max-[768px]:min-h-[250px]"
            />
            <HelpText>내용은 최소 100자 이상 작성해주세요.</HelpText>

            <input
              ref={contentImageInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleContentImageUpload}
              className="hidden"
            />
          </div>

          <div className="grid grid-cols-[1fr_1fr] gap-4 max-[768px]:grid-cols-[1fr] max-[768px]:gap-3">
            <div className={formGroupClasses}>
              <label htmlFor="status" className={labelClasses}>
                상태
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="draft">초안</option>
                <option value="published">발행</option>
              </select>
            </div>

            <div className={formGroupClasses}>
              <label htmlFor="category" className={labelClasses}>
                카테고리
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={selectClasses}
              >
                <option value="announcement">announcement</option>
                <option value="review">review</option>
                <option value="info">info</option>
              </select>
            </div>

            <div className={formGroupClasses}>
              <label htmlFor="featured" className={labelClasses}>
                Featured
              </label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <input
                  id="featured"
                  name="featured"
                  type="checkbox"
                  checked={formData.featured}
                  onChange={handleCheckbox}
                />
                <span style={{ color: colors.text.medium, fontSize: "0.9rem" }}>
                  상단 Featured 섹션에 노출
                </span>
              </div>
            </div>

            <div className={formGroupClasses}>
              <label className={labelClasses}>대표 이미지</label>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="featured-image"
                  className="inline-block px-6 py-3 bg-primary-pale text-ink border border-line rounded text-[0.9rem] font-medium [font-family:inherit] cursor-pointer [transition:all_0.2s_ease] hover:bg-primary-light hover:text-white hover:border-primary-light max-[768px]:px-5 max-[768px]:py-2.5 max-[768px]:text-[0.85rem]"
                >
                  파일 선택
                </label>

                {formData.featuredImage && (
                  <div className="mt-4 rounded overflow-hidden border border-line max-w-[300px] [&_img]:w-full [&_img]:h-auto [&_img]:block max-[768px]:max-w-full">
                    <img
                      src={formData.featuredImage}
                      alt="대표 이미지 미리보기"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveFeaturedImage}
                      title="이미지 제거"
                      className="bg-[#ef4444] text-white border-none rounded-full w-6 h-6 cursor-pointer text-[12px] flex items-center justify-center [transition:all_0.2s_ease] hover:bg-[#dc2626] hover:[transform:scale(1.1)]"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <input
                  id="featured-image"
                  ref={featuredImageInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFeaturedImageUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className={formGroupClasses}>
            <label htmlFor="tags" className={labelClasses}>
              태그
            </label>
            <input
              id="tags"
              name="tags"
              type="text"
              value={formData.tags}
              onChange={handleChange}
              placeholder="태그를 쉼표로 구분하여 입력하세요 (예: 영어학습, 비즈니스, 팁)"
              className={inputClasses}
            />
            <HelpText>
              태그는 쉼표(,)로 구분하여 입력해주세요. 독자들이 관련 포스트를
              찾는데 도움이 됩니다.
            </HelpText>
          </div>

          {uploadError && (
            <div className="text-[#dc2626] text-[0.85rem] mt-2">
              {uploadError}
            </div>
          )}
          {uploadProgress && (
            <div className="mt-2 text-ink-medium text-[0.85rem]">
              {uploadProgress}
            </div>
          )}

          <div className="flex gap-4 justify-end mt-8 pt-6 border-t border-line max-[768px]:flex-col-reverse max-[768px]:gap-3 max-[768px]:mt-6 max-[768px]:pt-5">
            <button
              type="button"
              onClick={onCancel}
              disabled={uploading}
              className={secondaryButtonClasses}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className={primaryButtonClasses}
            >
              {saving
                ? "저장 중..."
                : uploading
                ? "업로드 중..."
                : post
                ? "수정하기"
                : "발행하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
