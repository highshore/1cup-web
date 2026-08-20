import { admin } from "../../../supabase/server";

export interface HomeTopicArticle {
  id: string;
  titleEnglish: string;
  titleKorean: string;
  imageUrl?: string;
  excerpt: string;
  keywords: string[];
  timestampISO: string;
}

// Server-side fetch using Supabase as the source of truth. The old Firebase document
// IDs were a fixed list, which left the home carousel pointing at stale records after
// the migration instead of the articles currently published in Supabase.
export const fetchHomeTopics = async (): Promise<HomeTopicArticle[]> => {
  try {
    const { data, error } = await admin()
      .from("articles")
      .select("*")
      .eq("publication_status", "published")
      .order("timestamp", { ascending: false, nullsFirst: false })
      .limit(7);

    if (error) {
      console.error("Error batch-fetching home topics:", error);
      return [];
    }

    const topics: HomeTopicArticle[] = (data ?? []).map((row) => {
      const article = row as Record<string, any>;
      const title = article.title || {};
      const content = article.content || {};
      const contentEnglish: string[] = content?.english || [];
      // `summary`/`excerpt` are not columns; fall back to first English paragraph.
      const excerpt = contentEnglish[0] || "";

      const timestampRaw = article.timestamp;

      return {
        id: article.id,
        titleEnglish: title?.english || "",
        titleKorean: title?.korean || "",
        imageUrl: article.image_url || "",
        excerpt: excerpt.slice(0, 140),
        keywords: Array.isArray(article.pronunciation_keywords)
          ? article.pronunciation_keywords.slice(0, 5)
          : [],
        timestampISO: timestampRaw
          ? new Date(timestampRaw).toISOString()
          : new Date().toISOString(),
      };
    });

    console.log(`Server: Fetched ${topics.length} topics from Supabase`);
    return topics;
  } catch (error) {
    console.error("Error fetching home topics:", error);
    return [];
  }
};
