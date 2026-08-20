import { supabase } from "../../../supabase/client";

export interface HomeTopicArticle {
  id: string;
  titleEnglish: string;
  titleKorean: string;
  imageUrl?: string;
  excerpt: string;
  keywords: string[];
  timestampISO: string;
}

// Client-side fallback mirrors the server query so a static or failed initial render
// cannot revive the retired Firebase featured-ID list.
export const fetchHomeTopicsClient = async (): Promise<HomeTopicArticle[]> => {
  try {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("publication_status", "published")
      .order("timestamp", { ascending: false, nullsFirst: false })
      .limit(7);

    if (error) {
      console.error("Error fetching home topics (client):", error);
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

    console.log(`Fetched ${topics.length} topics from Supabase`);
    return topics;
  } catch (error) {
    console.error("Error fetching home topics (client):", error);
    return [];
  }
};
