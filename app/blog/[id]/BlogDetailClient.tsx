"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import styled, { keyframes } from "styled-components";
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

const theme = {
  surface: "#ffffff",
  surfaceAlt: "#f3f3f1",
  border: "#050505",
  softBorder: "rgba(5, 5, 5, 0.12)",
  shadow: "#050505",
  text: {
    dark: "#050505",
    medium: "rgba(5, 5, 5, 0.68)",
    light: "#ffffff",
  },
  gray: {
    light: "#f8f8f6",
    medium: "#f3f3f1",
    dark: "rgba(5, 5, 5, 0.68)",
  },
  primaryPale: "#fff8dc",
  accent: "#f47a4a",
  accentHover: "#e86434",
} as const;

const DetailContainer = styled.div`
  padding: clamp(1.5rem, 4vw, 2.75rem) clamp(1rem, 4vw, 1.5rem)
    clamp(3rem, 6vw, 4rem);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  line-height: 1.6;
  background-color: transparent;
  min-height: 100vh;

  > * {
    max-width: 960px;
    margin-left: auto;
    margin-right: auto;
  }

  @media (max-width: 768px) {
    padding: 1.25rem 0.9rem 3rem;
  }
`;

const BackButton = styled.button`
  background: #ffffff;
  color: ${theme.text.dark};
  border: 2px solid ${theme.border};
  border-radius: 999px;
  padding: 0.75rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 850;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  margin-bottom: 2rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 3px 3px 0 ${theme.accent};

  &:hover {
    background: ${theme.primaryPale};
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 ${theme.accent};
  }

  @media (max-width: 768px) {
    margin-bottom: 1.5rem;
    padding: 0.625rem 1.25rem;
  }
`;

const FooterNav = styled.div`
  margin-top: 1.5rem;
  display: flex;
  justify-content: left;
`;

const BackLink = styled.button`
  background: transparent;
  color: ${theme.text.medium};
  border: none;
  padding: 0.375rem 0.75rem;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border-radius: 9999px;
  transition: color 0.2s ease, background 0.2s ease, opacity 0.2s ease;
  opacity: 0.8;

  &:hover {
    opacity: 1;
    color: ${theme.text.dark};
    background: rgba(5, 5, 5, 0.06);
  }
`;

const FeaturedImage = styled.div`
  width: 100%;
  height: 450px;
  background: ${theme.gray.medium};
  border: 2px solid ${theme.border};
  border-radius: 14px;
  margin-bottom: 2rem;
  box-shadow: 4px 4px 0 ${theme.shadow};
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  @media (max-width: 768px) {
    height: 250px;
    margin-bottom: 1.5rem;
  }
`;

const FeaturedImageAsset = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ImagePlaceholder = styled.div`
  color: ${theme.text.medium};
  font-size: 3rem;
  font-weight: 300;

  svg {
    width: 3rem;
    height: 3rem;
  }

  @media (max-width: 768px) {
    font-size: 2.5rem;

    svg {
      width: 2.5rem;
      height: 2.5rem;
    }
  }
`;

const StatusBadge = styled.div<{ $status: string }>`
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: white;
  background: ${(props) => {
    switch (props.$status) {
      case "published":
        return "#10b981";
      case "draft":
        return "#f59e0b";
      case "archived":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  }};
`;

const PostHeader = styled.header`
  margin-bottom: 2rem;
  border-bottom: 2px solid ${theme.border};
  padding-bottom: 1.35rem;
`;

const PostTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 950;
  color: ${theme.text.dark};
  margin-bottom: 1rem;
  line-height: 1.2;
  font-family: inherit;
  letter-spacing: -0.02em;

  @media (max-width: 768px) {
    font-size: 2rem;
    margin-bottom: 0.75rem;
  }
`;

const PostMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.5rem 0 0 0;
  background-color: #ffffff;
  border: 2px solid ${theme.border};
  border-radius: 14px;
  padding: 1rem;
  box-shadow: 3px 3px 0 ${theme.accent};
`;

const AuthorAvatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid ${theme.border};

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
  }
`;

const AuthorInfo = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const AuthorName = styled.span`
  font-size: 0.9rem;
  font-weight: 600;
  color: ${theme.text.dark};

  @media (max-width: 768px) {
    font-size: 0.85rem;
  }
`;

const PostDate = styled.span`
  color: ${theme.text.dark};
  font-size: 0.8rem;
  font-weight: 400;

  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const Tag = styled.span`
  background: #ffffff;
  color: ${theme.text.dark};
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 750;
  border: 1.5px solid ${theme.border};
`;

const PostContent = styled.div`
  font-size: 1.05rem;
  line-height: 1.5;
  color: ${theme.text.dark};
  font-family: inherit;
  margin-bottom: 2rem;
  background: #ffffff;
  border: 2px solid ${theme.border};
  border-radius: 14px;
  padding: clamp(1.25rem, 3vw, 2rem);
  box-shadow: 4px 4px 0 ${theme.shadow};

  /* Enhanced typography styles */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-family: inherit;
    color: ${theme.text.dark};
    margin: 1.1rem 0 0.45rem 0;
    font-weight: 850;
    line-height: 1.15;
    letter-spacing: -0.01em;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
  }
  h2 {
    font-size: 1.75rem;
    font-weight: 700;
  }
  h3 {
    font-size: 1.5rem;
    font-weight: 600;
  }
  h4 {
    font-size: 1.25rem;
    font-weight: 600;
  }
  h5 {
    font-size: 1.125rem;
    font-weight: 600;
  }
  h6 {
    font-size: 1rem;
    font-weight: 600;
  }

  /* First paragraph after heading has no top margin */
  h1 + p,
  h2 + p,
  h3 + p,
  h4 + p,
  h5 + p,
  h6 + p {
    margin-top: 0.5rem;
  }

  p {
    margin-bottom: 0.9rem;
    font-family: inherit;
  }

  /* Enhanced bold text styling */
  strong,
  b {
    font-weight: 600;
    color: ${theme.text.dark};
  }

  img {
    max-width: 100%;
    height: auto;
    border: 2px solid ${theme.border};
    border-radius: 12px;
    margin: 1.25rem 0;
    display: block;
  }

  blockquote {
    border-left: 4px solid ${theme.accent};
    padding-left: 1rem;
    margin: 1.25rem 0;
    font-style: italic;
    color: ${theme.text.medium};
    background: ${theme.primaryPale};
    padding: 0.85rem 1.25rem;
    border: 1.5px solid ${theme.border};
    border-radius: 12px;
  }

  ul,
  ol {
    padding-left: 1.25rem;
    margin-bottom: 0.9rem;
  }

  li {
    margin-bottom: 0.35rem;
  }

  code {
    background: ${theme.surfaceAlt};
    padding: 0.2rem 0.45rem;
    border-radius: 8px;
    font-family: "JetBrains Mono", "Monaco", "Consolas", monospace;
    font-size: 0.9em;
    border: 1px solid ${theme.border};
    color: ${theme.text.dark};
  }

  pre {
    background: ${theme.surfaceAlt};
    padding: 1.25rem;
    border-radius: 12px;
    overflow-x: auto;
    margin: 1.25rem 0;
    border: 1.5px solid ${theme.border};
    font-family: "JetBrains Mono", "Monaco", "Consolas", monospace;
  }

  /* Better spacing for br tags */
  br {
    line-height: 1.6;
  }

  @media (max-width: 768px) {
    font-size: 1rem;
    margin-bottom: 2rem;

    h1 {
      font-size: 1.75rem;
    }
    h2 {
      font-size: 1.5rem;
    }
    h3 {
      font-size: 1.25rem;
    }
    h4 {
      font-size: 1.125rem;
    }
    h5,
    h6 {
      font-size: 1rem;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin: 1.5rem 0 0.75rem 0;
    }

    p {
      margin-bottom: 1.25rem;
    }

    img {
      margin: 1rem 0;
    }

    blockquote {
      padding: 0.75rem 1.25rem;
      margin: 1.5rem 0;
      border-radius: 20px;
    }

    ul,
    ol {
      margin-bottom: 1.25rem;
    }

    pre {
      padding: 1.25rem;
      margin: 1.5rem 0;
      border-radius: 20px;
    }
  }
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  font-size: 1.1rem;
  color: ${theme.text.medium};
`;

const ErrorState = styled.div`
  text-align: center;
  padding: 1.25rem;
  color: #ef4444;
  background: #fef2f2;
  border-radius: 14px;
  border: 2px solid #991b1b;
  margin: 1.25rem 0;
`;

// Gradient shining sweep animation for CTA button
const gradientShine = keyframes`
  0% {
    background-position: -100% center;
  }
  100% {
    background-position: 100% center;
  }
`;

const CTASection = styled.div`
  position: relative;
  border: 2px solid ${theme.border};
  border-radius: 14px;
  padding: 3rem;
  text-align: center;
  margin-top: 3rem;
  overflow: hidden;
  box-shadow: 4px 4px 0 ${theme.shadow};

  @media (max-width: 768px) {
    padding: 2rem;
  }
`;

const CTAVideoBackground = styled.video`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
`;

const CTAOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1;
`;

const CTAContent = styled.div`
  position: relative;
  z-index: 2;
`;

const CTATitle = styled.h3`
  font-size: 1.75rem;
  font-weight: 900;
  color: ${theme.text.light};
  margin-bottom: 1rem;
  font-family: inherit;

  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const CTADescription = styled.p`
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.82);
  margin-bottom: 1.5rem;
  line-height: 1.5;
  font-family: inherit;

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;

const CTAButton = styled.button`
  padding: 0.85rem 1.75rem;
  border: 2px solid ${theme.border};
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  position: relative;
  overflow: hidden;
  color: ${theme.text.dark};
  font-family: inherit;
  background: #ffffff;
  box-shadow: 3px 3px 0 ${theme.accent};

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      120deg,
      rgba(255, 255, 255, 0) 15%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0) 85%
    );
    background-size: 200% 100%;
    animation: ${gradientShine} 2.5s linear infinite;
    pointer-events: none;
  }

  &:hover {
    background: ${theme.primaryPale};
    border-color: ${theme.border};
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 ${theme.accent};
  }

  @media (max-width: 768px) {
    padding: 0.875rem 1.5rem;
    font-size: 0.9rem;
    gap: 0.375rem;
  }

  svg {
    width: 1.1rem;
    height: 1.1rem;
  }
`;

const AdminControls = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid rgba(5, 5, 5, 0.1);

  @media (max-width: 768px) {
    justify-content: center;
  }
`;

const AdminButton = styled.button`
  background: #ffffff;
  color: ${theme.text.dark};
  border: 2px solid ${theme.border};
  border-radius: 999px;
  padding: 0.65rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 850;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: ${theme.primaryPale};
    transform: translate(-1px, -1px);
  }

  &.delete {
    background: #991b1b;
    color: #ffffff;
    border-color: ${theme.border};

    &:hover {
      background: #7f1d1d;
    }
  }
`;

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
      <DetailContainer>
        <ErrorState>{error || "포스트를 찾을 수 없습니다."}</ErrorState>
        <BackButton onClick={handleBack}>← Back to Blog</BackButton>
      </DetailContainer>
    );
  }

  return (
    <DetailContainer>
      <FeaturedImage>
        {post.featuredImage ? (
          <FeaturedImageAsset
            src={post.featuredImage}
            alt={post.title}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <ImagePlaceholder>
            <DocumentTextIcon />
          </ImagePlaceholder>
        )}
        {isAdmin && (
          <StatusBadge $status={post.status}>{post.status}</StatusBadge>
        )}
      </FeaturedImage>

      <PostHeader>
        <PostTitle>{post.title}</PostTitle>
        <PostMeta>
          <AuthorAvatar
            src="/images/logos/1cup_logo.jpg"
            alt="English Cup Logo"
          />
          <AuthorInfo>
            <AuthorName>영어 한잔 운영진</AuthorName>
            <PostDate>
              {formatDate(post.publishedAt || post.createdAt)}
            </PostDate>
          </AuthorInfo>
        </PostMeta>

        {post.tags && post.tags.length > 0 && (
          <TagsContainer>
            {post.tags.map((tag, index) => (
              <Tag key={index}>{tag}</Tag>
            ))}
          </TagsContainer>
        )}
      </PostHeader>

      <PostContent
        dangerouslySetInnerHTML={{
          __html: renderContent(post.content),
        }}
      />

      <CTASection>
        <CTAVideoBackground autoPlay loop muted playsInline>
          <source src="/assets/blog/manhattan.mp4" type="video/mp4" />
        </CTAVideoBackground>
        <CTAOverlay />
        <CTAContent>
          <CTATitle>영어 소통 능력을 키우고 싶다면?</CTATitle>
          <CTADescription>
            통역사, 직장인, 대학생, 전문가 등 다양한 백그라운드를 가진 <br />
            멤버들과 함께하는 영어 밋업에 참여해보세요.
            <br />
          </CTADescription>
          <CTAButton onClick={handleMeetupClick}>
            <RocketLaunchIcon />
            밋업 확인하기
          </CTAButton>
        </CTAContent>
      </CTASection>

      {isAdmin && (
        <AdminControls>
          <AdminButton onClick={handleEditPost}>Edit Post</AdminButton>
          <AdminButton className="delete" onClick={handleDeletePost}>
            Delete Post
          </AdminButton>
        </AdminControls>
      )}

      <FooterNav>
        <BackLink onClick={handleBack}>← Back to Blog</BackLink>
      </FooterNav>
    </DetailContainer>
  );
}
