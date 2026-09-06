"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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

// Clean, minimal blog palette — values are inlined in the Tailwind classes below:
// text dark #050505 / medium rgba(5,5,5,0.68) / light rgba(5,5,5,0.48),
// border #050505, accent #f47a4a, smoke #f3f3f1

const fontStack =
  "[font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif]";

const adminButtonClasses =
  "bg-white text-[#050505] border-2 border-[#050505] rounded-full px-6 py-3 text-[0.9rem] font-[850] [font-family:inherit] cursor-pointer [transition:transform_0.18s_ease,box-shadow_0.18s_ease,background_0.18s_ease] flex items-center gap-2 shadow-[3px_3px_0_#f47a4a] hover:bg-[#fff8dc] hover:[transform:translate(-1px,-1px)] hover:shadow-[4px_4px_0_#f47a4a] active:[transform:translateY(0)] max-[768px]:px-5 max-[768px]:py-2.5 max-[768px]:text-[0.85rem]";

const sectionRowClasses =
  "mx-auto mt-0 mb-12 max-w-[960px] px-4 max-[768px]:mb-8 max-[768px]:px-3";

const scrollerClasses =
  "flex gap-4 overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] box-border relative w-full scroll-smooth py-3 px-0 max-[768px]:gap-3 max-[768px]:py-2";

const slideItemClasses =
  "w-[320px] flex-none cursor-pointer max-[768px]:w-[280px]";

const cardClasses =
  "border-2 border-[#050505] rounded-[14px] overflow-hidden bg-white shadow-[4px_4px_0_#050505] [transition:transform_0.18s_ease,box-shadow_0.18s_ease,border-color_0.18s_ease] cursor-pointer hover:[transform:translate(-1px,-1px)] hover:shadow-[5px_5px_0_#f47a4a] hover:border-[#050505] max-[768px]:shadow-[3px_3px_0_#050505]";

const cardImageClasses =
  "bg-[#f3f3f1] w-full h-[200px] overflow-hidden max-[768px]:h-[160px]";

const featuredImageClasses =
  "bg-[#f3f3f1] w-full h-[280px] overflow-hidden rounded-none max-[768px]:h-[200px]";

const cardBodyClasses =
  "pt-5 px-5 pb-6 max-[768px]:pt-4 max-[768px]:px-4 max-[768px]:pb-5";

const cardTitleClasses =
  "m-0 mb-3 text-[1.125rem] font-[850] text-[#050505] whitespace-nowrap overflow-hidden text-ellipsis leading-[1.4] tracking-[-0.01em] max-[768px]:text-[1.1rem] max-[768px]:mb-2";

const cardExcerptClasses =
  "m-0 mb-4 text-[rgba(5,5,5,0.68)] text-[0.95rem] leading-[1.5] line-clamp-3 opacity-90 max-[768px]:mb-3 max-[768px]:text-[0.9rem] max-[768px]:line-clamp-2";

const metaRowClasses =
  "flex justify-between items-center text-[rgba(5,5,5,0.48)] text-[0.8rem] mt-auto max-[768px]:text-[0.75rem]";

const sectionTitleClasses =
  "flex items-center gap-[0.55rem] w-full m-0 mb-5 leading-[1.2] max-[768px]:mb-[0.9rem]";

// the label text -> bold orange pill badge (no divider lines)
const sectionLabelClasses =
  "inline-flex items-center border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] px-[0.9rem] py-[0.3rem] text-[clamp(1rem,2vw,1.18rem)] font-[900] break-keep";

const sectionCountClasses =
  "inline-flex items-center flex-none border-[1.5px] border-[#050505] rounded-full bg-white text-[#050505] px-2 py-[0.1rem] text-[0.74rem] font-extrabold tabular-nums";

const ctaButtonClasses =
  "px-5 py-2.5 border-2 border-[#050505] rounded-full text-[0.875rem] font-[850] cursor-pointer [transition:all_0.2s_ease] inline-flex items-center justify-center gap-2 text-[#050505] [font-family:inherit] bg-white shadow-[3px_3px_0_#f47a4a] hover:bg-[#fff8dc] hover:[transform:translate(-1px,-1px)] hover:border-[#050505] hover:shadow-[4px_4px_0_#f47a4a] max-[768px]:px-4 max-[768px]:py-2 max-[768px]:text-[0.825rem]";

function ScrollButton({
  direction,
  disabled,
  children,
  ...rest
}: {
  direction: "left" | "right";
  disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled">) {
  // Note: `disabled` intentionally does NOT reach the DOM (parity with the
  // previous shouldForwardProp filter) — it only drives opacity/pointer-events.
  return (
    <button
      className={`absolute top-1/2 [transform:translateY(-50%)] w-10 h-10 rounded-full bg-white text-[#050505] border-2 border-[#050505] flex items-center justify-center cursor-pointer z-[100] [transition:all_0.25s_ease] hover:opacity-100 hover:shadow-[3px_3px_0_#f47a4a] hover:[transform:translateY(-50%)_scale(1.04)] ${
        disabled ? "opacity-0 pointer-events-none" : "opacity-90"
      } ${direction === "left" ? "-left-[15px]" : "-right-[15px]"}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// EdgeFade removed per design (no shades)

const BlogCardImage = ({
  image,
  title,
  featured = false,
}: {
  image?: string;
  title: string;
  featured?: boolean;
}) => {
  return (
    <div className={featured ? featuredImageClasses : cardImageClasses}>
      {image ? (
        <img
          className="block w-full h-full object-cover"
          src={image}
          alt={title}
          loading={featured ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={featured ? "high" : "auto"}
        />
      ) : null}
    </div>
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
    <div
      className={`pb-[clamp(3rem,6vw,4rem)] ${fontStack} bg-transparent min-h-screen max-[768px]:pb-6`}
    >
      {isAdmin && (
        <div className="flex justify-end mx-auto mt-0 mb-6 max-w-[960px] gap-3 max-[768px]:justify-center max-[768px]:flex-wrap">
          <button className={adminButtonClasses} onClick={handleCreatePost}>
            + New Post
          </button>
          <button className={adminButtonClasses} onClick={loadBlogPosts}>
            Refresh
          </button>
        </div>
      )}

      {error && (
        <div className="text-center p-8 text-[#dc2626] bg-[#fef2f2] rounded-[14px] border-2 border-[#991b1b] my-8 [font-family:inherit]">
          {error}
        </div>
      )}

      {(loading || isNavigatingPost) && <GlobalLoadingScreen />}

      {!loading && blogPosts.length === 0 && !error && (
        <div className="text-center px-8 py-16 text-[rgba(5,5,5,0.68)] bg-transparent border-2 border-dashed border-[rgba(5,5,5,0.28)] rounded-[14px] [font-family:inherit] max-[768px]:px-6 max-[768px]:py-12">
          <h3 className="text-[1.5rem] mb-4 text-[#050505] [font-family:inherit] font-bold max-[768px]:text-[1.3rem]">
            No posts yet
          </h3>
          <p className="text-[1rem] leading-[1.5] [font-family:inherit] max-[768px]:text-[0.9rem]">
            Be the first to share your thoughts!
          </p>
        </div>
      )}

      {!loading && blogPosts.length > 0 && featuredPost && (
        <section className={sectionRowClasses}>
          <div className="relative w-full">
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
            <div className={scrollerClasses} id="featured-scroller">
              {/* Single featured card; structure preserved for consistency */}
              <div className="min-w-0 flex-[1_0_100%]">
                <article
                  className={`${cardClasses} flex flex-col`}
                  onClick={() => handlePostClick(featuredPost)}
                >
                  <BlogCardImage
                    image={featuredPost.featuredImage}
                    title={featuredPost.title}
                    featured
                  />
                  <div className="p-5 flex flex-col gap-3 mt-0 max-[768px]:gap-2 max-[768px]:p-4">
                    <h2 className="text-[1.75rem] tracking-[-0.01em] m-0 leading-[1.3] font-[900] text-[#050505] max-[768px]:text-[1.5rem]">
                      {featuredPost.title}
                    </h2>
                    <p className="text-[rgba(5,5,5,0.68)] text-[0.95rem] leading-[1.6] m-0 line-clamp-2 max-[768px]:text-[0.9rem]">
                      {getPostPreview(featuredPost, 180)}
                    </p>
                    <div className="mt-2 flex gap-3">
                      <button
                        className={ctaButtonClasses}
                        onClick={() => handlePostClick(featuredPost)}
                      >
                        Read more →
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </div>
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
          </div>
        </section>
      )}

      {!loading && announcements.length > 0 && (
        <section className={sectionRowClasses}>
          <h2 className={sectionTitleClasses}>
            <span className={sectionLabelClasses}>
              {dict.blog.announcements}
            </span>
            <span className={sectionCountClasses}>{announcements.length}</span>
          </h2>
          <div className="relative w-full">
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
            <div
              className={scrollerClasses}
              id="announcements-scroller"
              ref={announcementsRef}
              onScroll={() => updateArrows("announcements")}
            >
              {announcements.map((post) => (
                <div
                  className={slideItemClasses}
                  key={post.id}
                  onClick={() => handlePostClick(post)}
                >
                  <article className={cardClasses}>
                    <BlogCardImage image={post.featuredImage} title={post.title} />
                    <div className={cardBodyClasses}>
                      <h3 className={cardTitleClasses}>{post.title}</h3>
                      <p className={cardExcerptClasses}>
                        {getPostPreview(post, 120)}
                      </p>
                      <div className={metaRowClasses}>
                        <span>
                          {new Date(
                            (post.publishedAt || post.createdAt) as unknown as
                              | string
                              | number
                              | Date
                          ).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </div>
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
          </div>
        </section>
      )}


      {!loading && information.length > 0 && (
        <section className={sectionRowClasses}>
          <h2 className={sectionTitleClasses}>
            <span className={sectionLabelClasses}>
              {dict.blog.information}
            </span>
            <span className={sectionCountClasses}>{information.length}</span>
          </h2>
          <div className="relative w-full">
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
            <div
              className={scrollerClasses}
              id="info-scroller"
              ref={informationRef}
              onScroll={() => updateArrows("information")}
            >
              {information.map((post) => (
                <div
                  className={slideItemClasses}
                  key={post.id}
                  onClick={() => handlePostClick(post)}
                >
                  <article className={cardClasses}>
                    <BlogCardImage image={post.featuredImage} title={post.title} />
                    <div className={cardBodyClasses}>
                      <h3 className={cardTitleClasses}>{post.title}</h3>
                      <p className={cardExcerptClasses}>
                        {getPostPreview(post, 120)}
                      </p>
                      <div className={metaRowClasses}>
                        <span>
                          {new Date(
                            (post.publishedAt || post.createdAt) as unknown as
                              | string
                              | number
                              | Date
                          ).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </div>
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
          </div>
        </section>
      )}


      {!loading && reviews.length > 0 && (
        <section className={sectionRowClasses}>
          <h2 className={sectionTitleClasses}>
            <span className={sectionLabelClasses}>{dict.blog.reviews}</span>
            <span className={sectionCountClasses}>{reviews.length}</span>
          </h2>
          <div className="relative w-full">
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
            <div
              className={scrollerClasses}
              id="reviews-scroller"
              ref={reviewsRef}
              onScroll={() => updateArrows("reviews")}
            >
              {reviews.map((post) => (
                <div
                  className={slideItemClasses}
                  key={post.id}
                  onClick={() => handlePostClick(post)}
                >
                  <article className={cardClasses}>
                    <BlogCardImage image={post.featuredImage} title={post.title} />
                    <div className={cardBodyClasses}>
                      <h3 className={cardTitleClasses}>{post.title}</h3>
                      <p className={cardExcerptClasses}>
                        {getPostPreview(post, 120)}
                      </p>
                      <div className={metaRowClasses}>
                        <span>
                          {new Date(
                            (post.publishedAt || post.createdAt) as unknown as
                              | string
                              | number
                              | Date
                          ).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </div>
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
          </div>
        </section>
      )}
    </div>
  );
}
