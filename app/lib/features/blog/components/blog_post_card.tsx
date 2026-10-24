import React from "react";
import { colors } from "../../../constants/colors";
import { BlogPost } from "../types/blog_types";
import {
  DocumentTextIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

// Using shared colors

const statusBadgeBg: Record<string, string> = {
  published: "bg-[#22c55e]",
  draft: "bg-[#f59e0b]",
  archived: "bg-[#6b7280]",
};

function StatusBadge({
  $status,
  children,
}: {
  $status: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute top-3 right-3 px-2.5 py-1 rounded text-[0.75rem] font-semibold [font-family:inherit] uppercase tracking-[0.5px] text-white ${
        statusBadgeBg[$status] ?? "bg-[#6b7280]"
      } max-[768px]:text-[0.7rem] max-[768px]:px-2 max-[768px]:py-[3px] max-[768px]:top-2.5 max-[768px]:right-2.5`}
    >
      {children}
    </div>
  );
}

function ActionButton({
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const isDelete = className.includes("delete");
  return (
    <button
      className={`${className} bg-white border border-line rounded p-2 text-[0.9rem] cursor-pointer [transition:all_0.2s_ease] shadow-[0_2px_4px_rgba(0,0,0,0.1)] [&_svg]:w-4 [&_svg]:h-4 ${
        isDelete
          ? "hover:bg-[#ffeeee] hover:border-[#dc3545]"
          : "hover:bg-primary-pale hover:border-accent"
      } max-[768px]:p-1.5 max-[768px]:text-[0.8rem]`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface BlogPostCardProps {
  post: BlogPost;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClick?: () => void;
}

export const BlogPostCard: React.FC<BlogPostCardProps> = ({
  post,
  isAdmin,
  onEdit,
  onDelete,
  onClick,
}) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getExcerpt = () => {
    if (post.excerpt) return post.excerpt;

    // Create excerpt from content if not provided
    const textContent = post.content
      .replace(/<[^>]*>/g, "") // Strip HTML
      // Strip bold markdown from ****text**** and **text**
      .replace(/\*{4}([\s\S]+?)\*{4}/g, "$1")
      .replace(/\*\*(\S(?:[\s\S]*?\S)?)\*\*/g, "$1")
      .replace(/^# (.*$)/gim, "$1") // Remove header markdown
      .replace(/^## (.*$)/gim, "$1")
      .replace(/^### (.*$)/gim, "$1")
      // Remove image markdown: ![alt](url)
      .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, "")
      // Remove URLs that look like https://... or http://...
      .replace(/https?:\/\/[^\s]+/g, "")
      .trim();

    return textContent.length > 150
      ? textContent.substring(0, 150) + "..."
      : textContent;
  };

  return (
    <article
      onClick={onClick}
      className="group bg-white rounded-[20px] overflow-hidden shadow-app border border-line [transition:all_0.2s_ease] cursor-pointer relative [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif] flex flex-col h-[400px] min-[769px]:hover:[transform:translateY(-2px)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:border-accent max-[768px]:rounded max-[768px]:h-[360px] max-[768px]:hover:[transform:translateY(-1px)]"
    >
      <div
        className="w-full h-[200px] relative flex items-center justify-center border-b border-line max-[768px]:h-[160px]"
        style={{
          background:
            post.featuredImage
              ? `url(${post.featuredImage}) center/cover`
              : `${colors.gray.light}`,
        }}
      >
        {!post.featuredImage && (
          <div className="text-ink-light text-[2.5rem] font-light [&_svg]:w-10 [&_svg]:h-10 max-[768px]:text-[2rem] max-[768px]:[&_svg]:w-8 max-[768px]:[&_svg]:h-8">
            <DocumentTextIcon />
          </div>
        )}

        {isAdmin && (
          <>
            <StatusBadge $status={post.status}>{post.status}</StatusBadge>
            <div className="absolute top-3 left-3 flex gap-2 opacity-0 [transition:opacity_0.2s_ease] group-hover:opacity-100 max-[768px]:top-2.5 max-[768px]:left-2.5">
              <ActionButton className="edit" onClick={handleEdit} title="Edit">
                <PencilSquareIcon />
              </ActionButton>
              <ActionButton
                className="delete"
                onClick={handleDelete}
                title="Delete"
              >
                <TrashIcon />
              </ActionButton>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 p-6 flex flex-col min-h-0 max-[768px]:p-5">
        <div className="flex-1 flex flex-col">
          <h2 className="text-[1.25rem] font-semibold text-ink mb-3 leading-[1.3] [font-family:inherit] line-clamp-2 max-[768px]:text-[1.1rem] max-[768px]:mb-2">
            {post.title}
          </h2>
          <p className="text-[0.9rem] text-ink-medium leading-[1.5] mb-4 [font-family:inherit] line-clamp-3 max-[768px]:text-[0.85rem] max-[768px]:mb-3 max-[768px]:leading-[1.4]">
            {getExcerpt()}
          </p>
        </div>

        <div className="mt-auto pt-4 border-t border-line">
          <div className="flex justify-between items-center mb-3 max-[768px]:mb-2">
            <span className="text-[0.85rem] text-ink font-medium [font-family:inherit] max-[768px]:text-[0.8rem]">
              by 운영진
            </span>
            <span className="text-[0.8rem] text-ink-light [font-family:inherit] max-[768px]:text-[0.75rem]">
              {formatDate(post.publishedAt || post.createdAt)}
            </span>
          </div>

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="bg-primary-pale text-accent px-3 py-1 rounded text-[0.75rem] font-medium [font-family:inherit] border border-accent max-[768px]:text-[0.7rem] max-[768px]:px-[0.6rem] max-[768px]:py-[0.2rem]"
                >
                  {tag}
                </span>
              ))}
              {post.tags.length > 3 && (
                <span className="bg-primary-pale text-accent px-3 py-1 rounded text-[0.75rem] font-medium [font-family:inherit] border border-accent max-[768px]:text-[0.7rem] max-[768px]:px-[0.6rem] max-[768px]:py-[0.2rem]">
                  +{post.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
