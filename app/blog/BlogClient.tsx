"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { getDictionary } from "../lib/i18n";
import { useAuth } from "../lib/contexts/auth_context";
import { BlogPost } from "../lib/features/blog/types/blog_types";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";
import {
  fetchBlogPosts,
  fetchAllBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from "../lib/features/blog/services/blog_service";
import { BlogEditor } from "../lib/features/blog/components/blog_editor";

// Clean, minimal blog palette
const blog = {
  text: { dark: "#050505", medium: "rgba(5, 5, 5, 0.68)", light: "rgba(5, 5, 5, 0.48)" },
  border: "#050505",
  accent: "#f47a4a",
  smoke: "#f3f3f1",
} as const;

const BlogContainer = styled.div`
  padding: 0 0 clamp(3rem, 6vw, 4rem);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  background: transparent;
  min-height: 100vh;

  @media (max-width: 768px) {
    padding: 0 0 1.5rem;
  }
`;

const AdminControls = styled.div`
  display: flex;
  justify-content: flex-end;
  margin: 0 auto 1.5rem auto;
  max-width: 960px;
  gap: 0.75rem;

  @media (max-width: 768px) {
    justify-content: center;
    flex-wrap: wrap;
  }
`;

const AdminButton = styled.button`
  background: #ffffff;
  color: ${blog.text.dark};
  border: 2px solid ${blog.border};
  border-radius: 999px;
  padding: 0.75rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 850;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 3px 3px 0 ${blog.accent};

  &:hover {
    background: #fff8dc;
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 ${blog.accent};
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    padding: 0.625rem 1.25rem;
    font-size: 0.85rem;
  }
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  font-size: 1.1rem;
  color: ${blog.text.medium};
  background: transparent;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: ${blog.text.medium};
  background: transparent;
  border: 2px dashed rgba(5, 5, 5, 0.28);
  border-radius: 14px;
  font-family: inherit;

  h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: ${blog.text.dark};
    font-family: inherit;
    font-weight: 700;
  }

  p {
    font-size: 1rem;
    line-height: 1.5;
    font-family: inherit;
  }

  @media (max-width: 768px) {
    padding: 3rem 1.5rem;

    h3 {
      font-size: 1.3rem;
    }

    p {
      font-size: 0.9rem;
    }
  }
`;

const ErrorState = styled.div`
  text-align: center;
  padding: 2rem;
  color: #dc2626;
  background: #fef2f2;
  border-radius: 14px;
  border: 2px solid #991b1b;
  margin: 2rem 0;
  font-family: inherit;
`;

// Section scroller (re-usable for Featured / Annoucements / Reviews)
const SectionRow = styled.section`
  margin: 0 auto 3rem auto;
  max-width: 960px;
  padding: 0 1rem;

  @media (max-width: 768px) {
    margin: 0 auto 2rem auto;
    padding: 0 0.75rem;
  }
`;

const SectionDivider = styled.div`
  width: calc(100% - 2rem);
  height: 2px;
  background: rgba(5, 5, 5, 0.1);
  margin: 2.5rem auto;
  max-width: 920px;

  @media (max-width: 768px) {
    margin: 2rem auto;
    width: calc(100% - 1.5rem);
    max-width: 700px;
  }
`;

const SectionTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  margin: 0 0 1.25rem 0;
  line-height: 1.2;

  /* the label text -> bold orange pill badge (no divider lines) */
  > span:first-child {
    display: inline-flex;
    align-items: center;
    border: 2px solid #050505;
    border-radius: 999px;
    background: #f47a4a;
    color: #050505;
    padding: 0.3rem 0.9rem;
    font-size: clamp(1rem, 2vw, 1.18rem);
    font-weight: 900;
    word-break: keep-all;
  }

  @media (max-width: 768px) {
    margin: 0 0 0.9rem 0;
  }
`;

const SectionCount = styled.span`
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  padding: 0.1rem 0.5rem;
  font-size: 0.74rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
`;

const ScrollerWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const Scroller = styled.div`
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  position: relative;
  width: 100%;
  scroll-behavior: smooth;
  padding: 0.75rem 0;

  @media (max-width: 768px) {
    gap: 0.75rem;
    padding: 0.5rem 0;
  }
`;

const ScrollButton = styled.button.withConfig({
  shouldForwardProp: (prop) => prop !== "direction" && prop !== "disabled",
})<{
  direction: "left" | "right";
  disabled?: boolean;
}>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #ffffff;
  color: ${blog.text.dark};
  border: 2px solid ${blog.border};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
  opacity: ${(props) => (props.disabled ? 0.0 : 0.9)};
  pointer-events: ${(props) => (props.disabled ? "none" : "auto")};
  transition: all 0.25s ease;

  &:hover {
    opacity: 1;
    box-shadow: 3px 3px 0 ${blog.accent};
    transform: translateY(-50%) scale(1.04);
  }

  ${(props) => (props.direction === "left" ? `left: -15px;` : `right: -15px;`)}
`;

// EdgeFade removed per design (no shades)

// List card
const Card = styled.article`
  border: 2px solid ${blog.border};
  border-radius: 14px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 4px 4px 0 #050505;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  cursor: pointer;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 ${blog.accent};
    border-color: ${blog.border};
  }

  @media (max-width: 768px) {
    box-shadow: 3px 3px 0 #050505;

    &:hover {
      transform: translate(-1px, -1px);
    }
  }
`;

const CardImage = styled.div`
  background: ${blog.smoke};
  width: 100%;
  height: 200px;
  overflow: hidden;

  @media (max-width: 768px) {
    height: 160px;
  }
`;

const CardImageAsset = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const CardBody = styled.div`
  padding: 1.25rem 1.25rem 1.5rem 1.25rem;

  @media (max-width: 768px) {
    padding: 1rem 1rem 1.25rem 1rem;
  }
`;

const CardTitle = styled.h3`
  margin: 0 0 0.75rem 0;
  font-size: 1.125rem;
  font-weight: 850;
  color: ${blog.text.dark};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  letter-spacing: -0.01em;

  @media (max-width: 768px) {
    font-size: 1.1rem;
    margin: 0 0 0.5rem 0;
  }
`;

const CardExcerpt = styled.p`
  margin: 0 0 1rem 0;
  color: ${blog.text.medium};
  font-size: 0.95rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  opacity: 0.9;

  @media (max-width: 768px) {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    -webkit-line-clamp: 2;
  }
`;

const MetaRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${blog.text.light};
  font-size: 0.8rem;
  margin-top: auto;

  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const SlideItem = styled.div`
  width: 320px;
  flex: 0 0 auto;
  cursor: pointer;

  @media (max-width: 768px) {
    width: 280px;
  }
`;

const PillRow = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: 0.75rem;

  @media (max-width: 768px) {
    margin-bottom: 0.5rem;
  }
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  border: 1.5px solid ${blog.border};
  background: #ffffff;
  color: ${blog.text.dark};
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 4px 8px;
  transition: all 0.2s ease;

  &:hover {
    background: #fff8dc;
    border-color: ${blog.border};
  }

  @media (max-width: 768px) {
    font-size: 0.65rem;
    padding: 3px 6px;
  }
`;

// Featured card uses the same standard Card styling (shadow, border, hover)
const FeaturedSlide = styled.div`
  min-width: 0;
  flex: 1 0 100%;
`;

const FeaturedCard = styled(Card)`
  display: flex;
  flex-direction: column;
`;

const FeaturedContent = styled.div`
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0;

  @media (max-width: 768px) {
    gap: 0.5rem;
    padding: 1rem;
  }
`;

const FeaturedTitle = styled.h2`
  font-size: 1.75rem;
  letter-spacing: -0.01em;
  margin: 0;
  line-height: 1.3;
  font-weight: 900;
  color: ${blog.text.dark};

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const FeaturedDescription = styled.p`
  color: ${blog.text.medium};
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;

const FeaturedButtons = styled.div`
  margin-top: 0.5rem;
  display: flex;
  gap: 0.75rem;
`;

const CTAButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: 2px solid ${blog.border};
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 850;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: ${blog.text.dark};
  font-family: inherit;
  background: #ffffff;
  box-shadow: 3px 3px 0 ${blog.accent};

  &:hover {
    background: #fff8dc;
    transform: translate(-1px, -1px);
    border-color: ${blog.border};
    box-shadow: 4px 4px 0 ${blog.accent};
  }

  @media (max-width: 768px) {
    padding: 0.5rem 1rem;
    font-size: 0.825rem;
  }
`;

const FeaturedImage = styled(CardImage)`
  height: 280px;
  border-radius: 0;
  overflow: hidden;

  @media (max-width: 768px) {
    height: 200px;
  }
`;

const BlogCardImage = ({
  image,
  title,
  featured = false,
}: {
  image?: string;
  title: string;
  featured?: boolean;
}) => {
  const Frame = featured ? FeaturedImage : CardImage;

  return (
    <Frame>
      {image ? (
        <CardImageAsset
          src={image}
          alt={title}
          loading={featured ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={featured ? "high" : "auto"}
        />
      ) : null}
    </Frame>
  );
};

const getPostPreview = (post: BlogPost, maxLength: number) => {
  if (post.excerpt) return post.excerpt;

  const cleaned = post.content
    .replace(/<[^>]*>/g, "")
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, "")
    .replace(/https?:\/\/[^\s]+/g, "");

  return `${cleaned.slice(0, maxLength)}${
    post.content.length > maxLength ? "..." : ""
  }`;
};

interface BlogClientProps {
  initialPosts: BlogPost[];
}

export function BlogClient({ initialPosts }: BlogClientProps) {
  const { accountStatus } = useAuth();
  const router = useRouter();
  const dict = getDictionary("ko");
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [isNavigatingPost, setIsNavigatingPost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  type SectionKey = "announcements" | "information" | "reviews";
  type ArrowState = { left: boolean; right: boolean };
  const announcementsRef = useRef<HTMLDivElement | null>(null);
  const informationRef = useRef<HTMLDivElement | null>(null);
  const reviewsRef = useRef<HTMLDivElement | null>(null);
  const [scrollDisabled, setScrollDisabled] = useState<
    Record<SectionKey, ArrowState>
  >({
    announcements: { left: true, right: true },
    information: { left: true, right: true },
    reviews: { left: true, right: true },
  });

  const computeArrowState = (el: HTMLDivElement | null): ArrowState => {
    if (!el) return { left: true, right: true };
    const isScrollable = el.scrollWidth > el.clientWidth + 1;
    if (!isScrollable) return { left: true, right: true };
    const left = el.scrollLeft <= 0;
    const right = Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth;
    return { left, right };
  };

  const updateArrows = (key: SectionKey) => {
    const map: Record<SectionKey, HTMLDivElement | null> = {
      announcements: announcementsRef.current,
      information: informationRef.current,
      reviews: reviewsRef.current,
    };
    const next = computeArrowState(map[key]);
    setScrollDisabled((prev) => ({ ...prev, [key]: next }));
  };

  // Derived collections for sections and featured
  const sortedPosts = [...blogPosts].sort((a, b) => {
    const aTime = (a.publishedAt || a.createdAt) as unknown as
      | string
      | number
      | Date;
    const bTime = (b.publishedAt || b.createdAt) as unknown as
      | string
      | number
      | Date;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
  const featuredIndex = sortedPosts.findIndex(
    (p) => p.featured === true && !!p.featuredImage
  );
  const featuredPost = sortedPosts[featuredIndex >= 0 ? featuredIndex : 0];
  const otherPosts = sortedPosts;
  const announcements = otherPosts.filter((p) => p.category === "announcement");
  const information = otherPosts.filter((p) => p.category === "info");
  const reviews = otherPosts.filter((p) => p.category === "review");

  // Check if user is admin
  const isAdmin = accountStatus === "admin";

  // Load initial data if not provided via SSR
  useEffect(() => {
    if (initialPosts.length === 0) {
      loadBlogPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when admin status changes
  useEffect(() => {
    if (isAdmin) {
      loadBlogPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    // Initialize and watch for size changes to compute overflow
    const ro = new ResizeObserver(() => {
      updateArrows("announcements");
      updateArrows("information");
      updateArrows("reviews");
    });
    if (announcementsRef.current) ro.observe(announcementsRef.current);
    if (informationRef.current) ro.observe(informationRef.current);
    if (reviewsRef.current) ro.observe(reviewsRef.current);

    // Initial run
    updateArrows("announcements");
    updateArrows("information");
    updateArrows("reviews");

    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcements.length, information.length, reviews.length]);

  const loadBlogPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Admin users see all posts, regular users see only published posts
      const posts = isAdmin
        ? await fetchAllBlogPosts()
        : await fetchBlogPosts();

      // Debug: Log blog posts
      console.log(
        "Loaded blog posts:",
        posts.map((post) => ({
          id: post.id,
          title: post.title,
        }))
      );

      setBlogPosts(posts);
    } catch (err) {
      console.error("Failed to fetch blog posts:", err);
      setError("블로그 포스트를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = () => {
    setEditingPost(null);
    setShowEditor(true);
  };

  const handleEditPost = (post: BlogPost) => {
    setEditingPost(post);
    setShowEditor(true);
  };

  const handleSavePost = async (postData: Partial<BlogPost>) => {
    try {
      setLoading(true);
      setError(null);

      if (editingPost) {
        // Update existing post
        await updateBlogPost(editingPost.id, postData);
      } else {
        // Create new post
        await createBlogPost(postData);
      }

      // Reload posts after save
      await loadBlogPosts();
      setShowEditor(false);
      setEditingPost(null);
    } catch (err) {
      console.error("Failed to save blog post:", err);
      setError("블로그 포스트 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("이 포스트를 삭제하시겠습니까?")) {
      return;
    }

    try {
      setLoading(true);
      await deleteBlogPost(postId);
      await loadBlogPosts();
    } catch (err) {
      console.error("Failed to delete blog post:", err);
      setError("블로그 포스트 삭제에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingPost(null);
  };

  const handlePostClick = (post: BlogPost) => {
    console.log("Navigating to post:", {
      id: post.id,
      title: post.title,
    });
    // Always use ID-based routing
    setIsNavigatingPost(true);
    router.push(`/blog/${post.id}`);
  };

  if (showEditor) {
    return (
      <BlogEditor
        post={editingPost}
        onSave={handleSavePost}
        onCancel={handleCloseEditor}
      />
    );
  }

  const categoryLabel = (cat?: string) => {
    switch (cat) {
      case "announcement":
        return dict.blog.announcements;
      case "info":
        return dict.blog.information;
      case "review":
        return dict.blog.reviews;
      default:
        return cat || "";
    }
  };

  // Show scroll buttons only when a section has 3 or more items
  const showFeaturedScroll = false; // single featured card; no need for scroll buttons
  const showAnnouncementsScroll = announcements.length >= 3;
  const showInformationScroll = information.length >= 3;
  const showReviewsScroll = reviews.length >= 3;

  return (
    <BlogContainer>
      {isAdmin && (
        <AdminControls>
          <AdminButton onClick={handleCreatePost}>+ New Post</AdminButton>
          <AdminButton onClick={loadBlogPosts}>Refresh</AdminButton>
        </AdminControls>
      )}

      {error && <ErrorState>{error}</ErrorState>}

      {(loading || isNavigatingPost) && <GlobalLoadingScreen />}

      {!loading && blogPosts.length === 0 && !error && (
        <EmptyState>
          <h3>No posts yet</h3>
          <p>Be the first to share your thoughts!</p>
        </EmptyState>
      )}

      {!loading && blogPosts.length > 0 && featuredPost && (
        <SectionRow>
          <ScrollerWrapper>
            {showFeaturedScroll && (
              <ScrollButton
                direction="left"
                onClick={() => {
                  const el = document.getElementById("featured-scroller");
                  if (el) el.scrollBy({ left: -400, behavior: "smooth" });
                }}
                aria-label="Scroll featured left"
              >
                <FaChevronLeft />
              </ScrollButton>
            )}
            <Scroller id="featured-scroller">
              {/* Single featured card; structure preserved for consistency */}
              <FeaturedSlide>
                <FeaturedCard onClick={() => handlePostClick(featuredPost)}>
                  <BlogCardImage
                    image={featuredPost.featuredImage}
                    title={featuredPost.title}
                    featured
                  />
                  <FeaturedContent>
                    <FeaturedTitle>{featuredPost.title}</FeaturedTitle>
                    <FeaturedDescription>
                      {getPostPreview(featuredPost, 180)}
                    </FeaturedDescription>
                    <FeaturedButtons>
                      <CTAButton onClick={() => handlePostClick(featuredPost)}>
                        Read more →
                      </CTAButton>
                    </FeaturedButtons>
                  </FeaturedContent>
                </FeaturedCard>
              </FeaturedSlide>
            </Scroller>
            {showFeaturedScroll && (
              <ScrollButton
                direction="right"
                onClick={() => {
                  const el = document.getElementById("featured-scroller");
                  if (el) el.scrollBy({ left: 400, behavior: "smooth" });
                }}
                aria-label="Scroll featured right"
              >
                <FaChevronRight />
              </ScrollButton>
            )}
          </ScrollerWrapper>
        </SectionRow>
      )}

      {!loading && announcements.length > 0 && (
        <SectionRow>
          <SectionTitle>
            <span>{dict.blog.announcements}</span>
            <SectionCount>{announcements.length}</SectionCount>
          </SectionTitle>
          <ScrollerWrapper>
            {showAnnouncementsScroll && (
              <ScrollButton
                direction="left"
                disabled={scrollDisabled.announcements.left}
                onClick={() => {
                  const el = announcementsRef.current;
                  if (el) el.scrollBy({ left: -400, behavior: "smooth" });
                }}
                aria-label="Scroll announcements left"
              >
                <FaChevronLeft />
              </ScrollButton>
            )}
            <Scroller
              id="announcements-scroller"
              ref={announcementsRef}
              onScroll={() => updateArrows("announcements")}
            >
              {announcements.map((post) => (
                <SlideItem key={post.id} onClick={() => handlePostClick(post)}>
                  <Card>
                    <BlogCardImage image={post.featuredImage} title={post.title} />
                    <CardBody>
                      <CardTitle>{post.title}</CardTitle>
                      <CardExcerpt>
                        {getPostPreview(post, 120)}
                      </CardExcerpt>
                      <MetaRow>
                        <span>
                          {new Date(
                            (post.publishedAt || post.createdAt) as unknown as
                              | string
                              | number
                              | Date
                          ).toLocaleDateString("ko-KR")}
                        </span>
                      </MetaRow>
                    </CardBody>
                  </Card>
                </SlideItem>
              ))}
            </Scroller>
            {showAnnouncementsScroll && (
              <ScrollButton
                direction="right"
                disabled={scrollDisabled.announcements.right}
                onClick={() => {
                  const el = announcementsRef.current;
                  if (el) el.scrollBy({ left: 400, behavior: "smooth" });
                }}
                aria-label="Scroll announcements right"
              >
                <FaChevronRight />
              </ScrollButton>
            )}
          </ScrollerWrapper>
        </SectionRow>
      )}


      {!loading && information.length > 0 && (
        <SectionRow>
          <SectionTitle>
            <span>{dict.blog.information}</span>
            <SectionCount>{information.length}</SectionCount>
          </SectionTitle>
          <ScrollerWrapper>
            {showInformationScroll && (
              <ScrollButton
                direction="left"
                disabled={scrollDisabled.information.left}
                onClick={() => {
                  const el = informationRef.current;
                  if (el) el.scrollBy({ left: -400, behavior: "smooth" });
                }}
                aria-label="Scroll information left"
              >
                <FaChevronLeft />
              </ScrollButton>
            )}
            <Scroller
              id="info-scroller"
              ref={informationRef}
              onScroll={() => updateArrows("information")}
            >
              {information.map((post) => (
                <SlideItem key={post.id} onClick={() => handlePostClick(post)}>
                  <Card>
                    <BlogCardImage image={post.featuredImage} title={post.title} />
                    <CardBody>
                      <CardTitle>{post.title}</CardTitle>
                      <CardExcerpt>
                        {getPostPreview(post, 120)}
                      </CardExcerpt>
                      <MetaRow>
                        <span>
                          {new Date(
                            (post.publishedAt || post.createdAt) as unknown as
                              | string
                              | number
                              | Date
                          ).toLocaleDateString("ko-KR")}
                        </span>
                      </MetaRow>
                    </CardBody>
                  </Card>
                </SlideItem>
              ))}
            </Scroller>
            {showInformationScroll && (
              <ScrollButton
                direction="right"
                disabled={scrollDisabled.information.right}
                onClick={() => {
                  const el = informationRef.current;
                  if (el) el.scrollBy({ left: 400, behavior: "smooth" });
                }}
                aria-label="Scroll information right"
              >
                <FaChevronRight />
              </ScrollButton>
            )}
          </ScrollerWrapper>
        </SectionRow>
      )}


      {!loading && reviews.length > 0 && (
        <SectionRow>
          <SectionTitle>
            <span>{dict.blog.reviews}</span>
            <SectionCount>{reviews.length}</SectionCount>
          </SectionTitle>
          <ScrollerWrapper>
            {showReviewsScroll && (
              <ScrollButton
                direction="left"
                disabled={scrollDisabled.reviews.left}
                onClick={() => {
                  const el = reviewsRef.current;
                  if (el) el.scrollBy({ left: -400, behavior: "smooth" });
                }}
                aria-label="Scroll reviews left"
              >
                <FaChevronLeft />
              </ScrollButton>
            )}
            <Scroller
              id="reviews-scroller"
              ref={reviewsRef}
              onScroll={() => updateArrows("reviews")}
            >
              {reviews.map((post) => (
                <SlideItem key={post.id} onClick={() => handlePostClick(post)}>
                  <Card>
                    <BlogCardImage image={post.featuredImage} title={post.title} />
                    <CardBody>
                      <CardTitle>{post.title}</CardTitle>
                      <CardExcerpt>
                        {getPostPreview(post, 120)}
                      </CardExcerpt>
                      <MetaRow>
                        <span>
                          {new Date(
                            (post.publishedAt || post.createdAt) as unknown as
                              | string
                              | number
                              | Date
                          ).toLocaleDateString("ko-KR")}
                        </span>
                      </MetaRow>
                    </CardBody>
                  </Card>
                </SlideItem>
              ))}
            </Scroller>
            {showReviewsScroll && (
              <ScrollButton
                direction="right"
                disabled={scrollDisabled.reviews.right}
                onClick={() => {
                  const el = reviewsRef.current;
                  if (el) el.scrollBy({ left: 400, behavior: "smooth" });
                }}
                aria-label="Scroll reviews right"
              >
                <FaChevronRight />
              </ScrollButton>
            )}
          </ScrollerWrapper>
        </SectionRow>
      )}
    </BlogContainer>
  );
}
