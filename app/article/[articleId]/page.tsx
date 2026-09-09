import { notFound } from "next/navigation";

import ArticleClient from "./ArticleClient";
import { publishedArticleExistsServer } from "../../lib/seo/content_server";

interface ArticlePageProps {
  params: Promise<{
    articleId: string;
  }>;
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { articleId } = await params;
  const normalizedArticleId = articleId.trim();

  if (!normalizedArticleId || !(await publishedArticleExistsServer(normalizedArticleId))) {
    notFound();
  }

  return (
    <div className="article-section-row-fix">
      <ArticleClient />
      <style>{`
        /* Keep section labels and their action buttons together, matching the
           compact toolbar treatment used elsewhere in the product. */
        .article-section-row-fix div:has(> h3 + div > button) {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 0.8rem !important;
          flex-wrap: wrap !important;
        }

        .article-section-row-fix div:has(> h3 + div > button) > div {
          margin-left: auto !important;
          align-self: center !important;
          justify-content: flex-end !important;
        }

        @media (max-width: 768px) {
          .article-section-row-fix div:has(> h3 + div > button) {
            flex-wrap: nowrap !important;
            gap: 0.45rem !important;
          }

          .article-section-row-fix div:has(> h3 + div > button) > h3 {
            flex: 0 1 auto !important;
            white-space: nowrap !important;
          }

          .article-section-row-fix div:has(> h3 + div > button) > div {
            flex: 0 0 auto !important;
          }
        }
      `}</style>
    </div>
  );
}
