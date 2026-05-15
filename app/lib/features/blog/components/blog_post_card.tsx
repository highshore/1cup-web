import React from "react";
import styled from "styled-components";
import { colors } from "../../../constants/colors";
import { BlogPost } from "../types/blog_types";
import {
  DocumentTextIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

// Using shared colors

const CardContainer = styled.article`
  background: white;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 2px 8px ${colors.shadow};
  border: 1px solid ${colors.border};
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;

  display: flex;
  flex-direction: column;
  height: 400px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px ${colors.shadow};
    border-color: ${colors.accent};
  }

  @media (max-width: 768px) {
    border-radius: 4px;
    height: 360px;

    &:hover {
      transform: translateY(-1px);
    }
  }
`;

const FeaturedImage = styled.div<{ $hasImage: boolean; $imageUrl?: string }>`
  width: 100%;
  height: 200px;
  background: ${(props) =>
    props.$hasImage && props.$imageUrl
      ? `url(${props.$imageUrl}) center/cover`
      : `${colors.gray.light}`};
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid ${colors.border};

  @media (max-width: 768px) {
    height: 160px;
  }
`;

const ImagePlaceholder = styled.div`
  color: ${colors.text.light};
  font-size: 2.5rem;
  font-weight: 300;

  svg {
    width: 2.5rem;
    height: 2.5rem;
  }

  @media (max-width: 768px) {
    font-size: 2rem;

    svg {
      width: 2rem;
      height: 2rem;
    }
  }
`;

const StatusBadge = styled.div<{ $status: string }>`
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: white;
  background: ${(props) => {
    switch (props.$status) {
      case "published":
        return "#22c55e";
      case "draft":
        return "#f59e0b";
      case "archived":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  }};

  @media (max-width: 768px) {
    font-size: 0.7rem;
    padding: 3px 8px;
    top: 10px;
    right: 10px;
  }
`;

const CardContent = styled.div`
  flex: 1;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  min-height: 0;

  @media (max-width: 768px) {
    padding: 1.25rem;
  }
`;

const ContentMain = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const ContentFooter = styled.div`
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid ${colors.border};
`;

const PostTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${colors.text.dark};
  margin-bottom: 0.75rem;
  line-height: 1.3;
  font-family: inherit;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  @media (max-width: 768px) {
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
  }
`;

const PostExcerpt = styled.p`
  font-size: 0.9rem;
  color: ${colors.text.medium};
  line-height: 1.5;
  margin-bottom: 1rem;
  font-family: inherit;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;

  @media (max-width: 768px) {
    font-size: 0.85rem;
    margin-bottom: 0.75rem;
    line-height: 1.4;
  }
`;

const PostMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;

  @media (max-width: 768px) {
    margin-bottom: 0.5rem;
  }
`;

const Author = styled.span`
  font-size: 0.85rem;
  color: ${colors.text.dark};
  font-weight: 500;
  font-family: inherit;

  @media (max-width: 768px) {
    font-size: 0.8rem;
  }
`;

const PostDate = styled.span`
  font-size: 0.8rem;
  color: ${colors.text.light};
  font-family: inherit;

  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const Tag = styled.span`
  background: ${colors.primaryPale};
  color: ${colors.accent};
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: inherit;
  border: 1px solid ${colors.accent};

  @media (max-width: 768px) {
    font-size: 0.7rem;
    padding: 0.2rem 0.6rem;
  }
`;

const AdminActions = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s ease;

  ${CardContainer}:hover & {
    opacity: 1;
  }

  @media (max-width: 768px) {
    top: 10px;
    left: 10px;
  }
`;

const ActionButton = styled.button`
  background: white;
  border: 1px solid ${colors.border};
  border-radius: 4px;
  padding: 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px ${colors.shadow};

  svg {
    width: 1rem;
    height: 1rem;
  }

  &:hover {
    background: ${colors.primaryPale};
    border-color: ${colors.accent};
  }

  &.delete:hover {
    background: #fee;
    border-color: #dc3545;
  }

  @media (max-width: 768px) {
    padding: 0.375rem;
    font-size: 0.8rem;
  }
`;

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
    <CardContainer onClick={onClick}>
      <FeaturedImage
        $hasImage={!!post.featuredImage}
        $imageUrl={post.featuredImage}
      >
        {!post.featuredImage && (
          <ImagePlaceholder>
            <DocumentTextIcon />
          </ImagePlaceholder>
        )}

        {isAdmin && (
          <>
            <StatusBadge $status={post.status}>{post.status}</StatusBadge>
            <AdminActions>
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
            </AdminActions>
          </>
        )}
      </FeaturedImage>

      <CardContent>
        <ContentMain>
          <PostTitle>{post.title}</PostTitle>
          <PostExcerpt>{getExcerpt()}</PostExcerpt>
        </ContentMain>

        <ContentFooter>
          <PostMeta>
            <Author>by 운영진</Author>
            <PostDate>
              {formatDate(post.publishedAt || post.createdAt)}
            </PostDate>
          </PostMeta>

          {post.tags && post.tags.length > 0 && (
            <TagsContainer>
              {post.tags.slice(0, 3).map((tag, index) => (
                <Tag key={index}>{tag}</Tag>
              ))}
              {post.tags.length > 3 && <Tag>+{post.tags.length - 3}</Tag>}
            </TagsContainer>
          )}
        </ContentFooter>
      </CardContent>
    </CardContainer>
  );
};
