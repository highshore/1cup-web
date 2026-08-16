import { supabase } from "../../../supabase/client";
import { FEATURED_ARTICLE_IDS } from "./featured_articles";

export interface HomeTopicArticle {
  id: string;
  titleEnglish: string;
  titleKorean: string;
  imageUrl?: string;
  excerpt: string;
  keywords: string[];
  timestampISO: string;
}

// Client-side fetch using the Supabase browser client - fetches specific articles by ID
export const fetchHomeTopicsClient = async (): Promise<HomeTopicArticle[]> => {
  try {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .in("id", FEATURED_ARTICLE_IDS);

    if (error) {
      console.error("Error fetching home topics (client):", error);
      return [];
    }

    const rows = data ?? [];
    const byId = new Map(rows.map((row) => [row.id, row]));

    const topics: HomeTopicArticle[] = FEATURED_ARTICLE_IDS.filter((id) => {
      if (!byId.has(id)) {
        console.warn(`Article ${id} not found in Supabase`);
        return false;
      }
      return true;
    }).map((id) => {
      const row = byId.get(id) as Record<string, any>;
      const title = row.title || {};
      const content = row.content || {};
      const contentEnglish: string[] = content?.english || [];
      // `summary`/`excerpt` are not columns; fall back to first English paragraph.
      const excerpt = contentEnglish[0] || "";
      const timestampRaw = row.timestamp;

      return {
        id: row.id,
        titleEnglish: title?.english || "",
        titleKorean: title?.korean || "",
        imageUrl: row.image_url || "",
        excerpt: excerpt.slice(0, 140),
        keywords: Array.isArray(row.pronunciation_keywords)
          ? row.pronunciation_keywords.slice(0, 5)
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
