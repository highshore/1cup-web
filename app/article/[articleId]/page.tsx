import ArticleClient from "./ArticleClient";

interface ArticlePageProps {
  params: Promise<{
    articleId: string;
  }>;
}

// Generate static paths for articles
export async function generateStaticParams(): Promise<
  Array<{ articleId: string }>
> {
  // Return empty array for now since articles are dynamic
  // Articles will be loaded client-side
  return [];
}

export default function ArticlePage({ params }: ArticlePageProps) {
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
