"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { BlogPost } from "../../lib/features/blog/types/blog_types";
import {
  fetchBlogPost,
  fetchPublishedBlogPost,
  deleteBlogPost,
  updateBlogPost,
} from "../../lib/features/blog/services/blog_service";
import { useAuth } from "../../lib/contexts/auth_context";
import { BlogEditor } from "../../lib/features/blog/components/blog_editor";
import GlobalLoadingScreen from "../../lib/components/GlobalLoadingScreen";
import { DocumentTextIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import "./blog-detail.css";

// Neo-brutalist detail theme — values inlined in the Tailwind classes below:
// surface #ffffff, surfaceAlt #f3f3f1, border/shadow #050505,
// text dark #050505 / medium rgba(5,5,5,0.68) / light #ffffff,
// primaryPale #fff8dc, accent #f47a4a

const detailContainerClasses =
  "pt-[clamp(1.5rem,4vw,2.75rem)] px-[clamp(1rem,4vw,1.5rem)] pb-[clamp(3rem,6vw,4rem)] [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif] leading-[1.6] bg-transparent min-h-screen [&>*]:max-w-[960px] [&>*]:mx-auto max-[768px]:pt-5 max-[768px]:px-[0.9rem] max-[768px]:pb-12";

const backButtonClasses =
  "bg-white text-[#050505] border-2 border-[#050505] rounded-full px-6 py-3 text-[0.9rem] font-[850] [font-family:inherit] cursor-pointer [transition:transform_0.18s_ease,box-shadow_0.18s_ease,background_0.18s_ease] mb-8 inline-flex items-center gap-2 shadow-[3px_3px_0_#f47a4a] hover:bg-[#fff8dc] hover:[transform:translate(-1px,-1px)] hover:shadow-[4px_4px_0_#f47a4a] max-[768px]:mb-6 max-[768px]:px-5 max-[768px]:py-2.5";

const errorStateClasses =
  "text-center p-5 text-[#ef4444] bg-[#fef2f2] rounded-[14px] border-2 border-[#991b1b] my-5";

const statusBadgeBg: Record<string, string> = {
  published: "bg-[#10b981]",
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
      className={`absolute top-3 right-3 px-3 py-1.5 rounded text-[0.75rem] font-semibold uppercase tracking-[0.5px] text-white ${
        statusBadgeBg[$status] ?? "bg-[#6b7280]"
      }`}
    >
      {children}
    </div>
  );
}

function AdminButton({
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const isDelete = className.includes("delete");
  return (
    <button
      className={`${className} ${
        isDelete
          ? "bg-[#991b1b] text-white hover:bg-[#7f1d1d]"
          : "bg-white text-[#050505] hover:bg-[#fff8dc]"
      } border-2 border-[#050505] rounded-full px-5 py-[0.65rem] text-[0.9rem] font-[850] [font-family:inherit] cursor-pointer [transition:all_0.2s_ease] flex items-center gap-2 hover:[transform:translate(-1px,-1px)]`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface BlogDetailClientProps {
  initialPost?: BlogPost | null;
}

export default function BlogDetailClient({
  initialPost,
}: BlogDetailClientProps) {
  const { id: postId } = useParams<{ id: string }>();
  const router = useRouter();
  const { accountStatus } = useAuth();
  const [post, setPost] = useState<BlogPost | null>(initialPost || null);
  const [loading, setLoading] = useState(!initialPost);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const isAdmin = accountStatus === "admin";

  useEffect(() => {
    // If we already have initial post data, don't fetch again unless user is admin
    if (initialPost && !isAdmin) {
      return;
    }

    const loadPost = async () => {
      if (!postId) {
        setError("포스트 ID가 없습니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Admin users can see all posts, regular users can only see published posts
        const postData = isAdmin
          ? await fetchBlogPost(postId)
          : await fetchPublishedBlogPost(postId);

        if (!postData) {
          setError("포스트를 찾을 수 없습니다.");
        } else {
          setPost(postData);
        }
      } catch (err) {
        console.error("Failed to fetch blog post:", err);
        setError("포스트를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [postId, isAdmin, initialPost]);

  const handleBack = () => {
    router.push("/blog");
  };

  const handleMeetupClick = () => {
    router.push("/meetup");
  };

  const handleEditPost = () => {
    setShowEditor(true);
  };

  const handleDeletePost = async () => {
    if (!postId) return;

    if (!window.confirm("정말로 이 포스트를 삭제하시겠습니까?")) {
      return;
    }

    try {
      await deleteBlogPost(postId);
      router.push("/blog");
    } catch (err) {
      console.error("Failed to delete blog post:", err);
      setError("블로그 포스트 삭제에 실패했습니다.");
    }
  };

  const handleSavePost = async (postData: Partial<BlogPost>) => {
    if (!postId) return;

    try {
      await updateBlogPost(postId, postData);
      setShowEditor(false);

      // Reload the post to see changes
      const updatedPost = isAdmin
        ? await fetchBlogPost(postId)
        : await fetchPublishedBlogPost(postId);

      if (updatedPost) {
        setPost(updatedPost);
      }
    } catch (err) {
      console.error("Failed to save blog post:", err);
      setError("블로그 포스트 저장에 실패했습니다.");
    }
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderContent = (content: string) => {
    // Enhanced markdown-like rendering with better bold text handling
    let processedContent = content
      // Normalize quad-asterisks to double-asterisks, but only if they surround content
      .replace(/\*{4}([\s\S]+?)\*{4}/g, "**$1**")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(
        /!\[([^\]]*)\]\(([^)]*)\s+"([^"]*)"?\)/g,
        '<img alt="$1" src="$2" class="size-$3" />'
      )
      .replace(
        /!\[([^\]]*)\]\(([^)]*)\)/g,
        '<img alt="$1" src="$2" class="size-medium" />'
      );

    // Support for bold text with heavy font weight: **text**
    // This regex ensures that it doesn't accidentally match parts of HTML tags
    processedContent = processedContent.replace(
      /\*\*([^*\n]+?)\*\*/g,
      "<strong>$1</strong>"
    );

    // Convert newlines to <br /> after processing other markdown
    processedContent = processedContent.replace(/\n/g, "<br />");

    return processedContent;
  };

  if (showEditor && post) {
    return (
      <BlogEditor
        post={post}
        onSave={handleSavePost}
        onCancel={handleCloseEditor}
      />
    );
  }

  if (loading) {
    return <GlobalLoadingScreen />;
  }

  if (error || !post) {
    return (
      <div className={detailContainerClasses}>
        <div className={errorStateClasses}>
          {error || "포스트를 찾을 수 없습니다."}
        </div>
        <button className={backButtonClasses} onClick={handleBack}>
          ← Back to Blog
        </button>
      </div>
    );
  }

  return (
    <div className={detailContainerClasses}>
      <div className="w-full h-[450px] bg-[#f3f3f1] border-2 border-[#050505] rounded-[14px] mb-8 shadow-[4px_4px_0_#050505] flex items-center justify-center relative max-[768px]:h-[250px] max-[768px]:mb-6">
        {post.featuredImage ? (
          <img
            className="block w-full h-full object-cover"
            src={post.featuredImage}
            alt={post.title}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <div className="text-[rgba(5,5,5,0.68)] text-[3rem] font-light [&_svg]:w-12 [&_svg]:h-12 max-[768px]:text-[2.5rem] max-[768px]:[&_svg]:w-10 max-[768px]:[&_svg]:h-10">
            <DocumentTextIcon />
          </div>
        )}
        {isAdmin && (
          <StatusBadge $status={post.status}>{post.status}</StatusBadge>
        )}
      </div>

      <header className="mb-8 border-b-2 border-[#050505] pb-[1.35rem]">
        <h1 className="text-[2.5rem] font-[950] text-[#050505] mb-4 leading-[1.2] [font-family:inherit] tracking-[-0.02em] max-[768px]:text-[2rem] max-[768px]:mb-3">
          {post.title}
        </h1>
        <div className="flex items-center gap-4 mt-6 bg-white border-2 border-[#050505] rounded-[14px] p-4 shadow-[3px_3px_0_#f47a4a]">
          <img
            className="w-10 h-10 rounded-full object-cover border-2 border-[#050505] max-[768px]:w-9 max-[768px]:h-9"
            src="/images/logos/1cup_logo.jpg"
            alt="English Cup Logo"
          />
          <div className="flex flex-col flex-1">
            <span className="text-[0.9rem] font-semibold text-[#050505] max-[768px]:text-[0.85rem]">
              영어 한잔 운영진
            </span>
            <span className="text-[#050505] text-[0.8rem] font-normal max-[768px]:text-[0.75rem]">
              {formatDate(post.publishedAt || post.createdAt)}
            </span>
          </div>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map((tag, index) => (
              <span
                key={index}
                className="bg-white text-[#050505] px-[0.85rem] py-[0.35rem] rounded-full text-[0.8rem] font-[750] border-[1.5px] border-[#050505]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div
        className="blog-detail-content text-[1.05rem] leading-[1.5] text-[#050505] [font-family:inherit] mb-8 bg-white border-2 border-[#050505] rounded-[14px] p-[clamp(1.25rem,3vw,2rem)] shadow-[4px_4px_0_#050505] max-[768px]:text-[1rem]"
        dangerouslySetInnerHTML={{
          __html: renderContent(post.content),
        }}
      />

      <div className="relative border-2 border-[#050505] rounded-[14px] p-12 text-center mt-12 overflow-hidden shadow-[4px_4px_0_#050505] max-[768px]:p-8">
        <video
          className="absolute top-0 left-0 w-full h-full object-cover z-0"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/assets/blog/manhattan.mp4" type="video/mp4" />
        </video>
        <div className="absolute top-0 left-0 w-full h-full bg-[rgba(0,0,0,0.7)] z-[1]" />
        <div className="relative z-[2]">
          <h3 className="text-[1.75rem] font-[900] text-white mb-4 [font-family:inherit] max-[768px]:text-[1.25rem]">
            영어 소통 능력을 키우고 싶다면?
          </h3>
          <p className="text-[1rem] text-[rgba(255,255,255,0.82)] mb-6 leading-[1.5] [font-family:inherit] max-[768px]:text-[0.9rem]">
            통역사, 직장인, 대학생, 전문가 등 다양한 백그라운드를 가진 <br />
            멤버들과 함께하는 영어 밋업에 참여해보세요.
            <br />
          </p>
          <button
            className="px-7 py-[0.85rem] border-2 border-[#050505] rounded-full text-[1rem] font-bold cursor-pointer [transition:all_0.25s_ease] inline-flex items-center justify-center gap-2 relative overflow-hidden text-[#050505] [font-family:inherit] bg-white shadow-[3px_3px_0_#f47a4a] before:content-[''] before:absolute before:inset-0 before:bg-[linear-gradient(120deg,rgba(255,255,255,0)_15%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0)_85%)] before:bg-[length:200%_100%] before:animate-[blog-gradient-shine_2.5s_linear_infinite] before:pointer-events-none hover:bg-[#fff8dc] hover:border-[#050505] hover:[transform:translate(-1px,-1px)] hover:shadow-[4px_4px_0_#f47a4a] max-[768px]:px-6 max-[768px]:py-[0.875rem] max-[768px]:text-[0.9rem] max-[768px]:gap-[0.375rem] [&_svg]:w-[1.1rem] [&_svg]:h-[1.1rem]"
            onClick={handleMeetupClick}
          >
            <RocketLaunchIcon />
            밋업 확인하기
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="flex justify-end gap-4 mt-8 pt-8 border-t-2 border-[rgba(5,5,5,0.1)] max-[768px]:justify-center">
          <AdminButton onClick={handleEditPost}>Edit Post</AdminButton>
          <AdminButton className="delete" onClick={handleDeletePost}>
            Delete Post
          </AdminButton>
        </div>
      )}

      <div className="mt-6 flex justify-start">
        <button
          className="bg-transparent text-[rgba(5,5,5,0.68)] border-none px-3 py-1.5 text-[0.9rem] font-medium [font-family:inherit] cursor-pointer rounded-full [transition:color_0.2s_ease,background_0.2s_ease,opacity_0.2s_ease] opacity-80 hover:opacity-100 hover:text-[#050505] hover:bg-[rgba(5,5,5,0.06)]"
          onClick={handleBack}
        >
          ← Back to Blog
        </button>
      </div>
    </div>
  );
}
