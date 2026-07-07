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

// Featured article IDs - these are the article table primary keys (Firestore doc ids).
// These should match the IDs in topics_service_client.ts
export const FEATURED_ARTICLE_IDS = [
  "Alx2pN2Wrv9jbP2MCNKo",
  "7WHMBwU9m8LtBYI2wQVA",
  "hienPf1lJL8GMBKkjnKm",
  "H1hBMM5hB7MqdXkbvvxp",
  "xI3D8ijG6Fp7UHHCvu9B",
  "Xi1YVDM6xqHYNTfnhW6X",
];

// Server-side fetch using Supabase service-role client - fetches specific articles by ID
export const fetchHomeTopics = async (): Promise<HomeTopicArticle[]> => {
  try {
    // Fetch all featured articles in a single round-trip via .in()
    const { data, error } = await admin()
      .from("articles")
      .select("*")
      .in("id", FEATURED_ARTICLE_IDS);

    if (error) {
      console.error("Error batch-fetching home topics:", error);
      return [];
    }

    const rows = data ?? [];

    // Preserve the original featured order (IN does not guarantee ordering).
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

    console.log(`Server: Fetched ${topics.length} topics from Supabase`);
    return topics;
  } catch (error) {
    console.error("Error fetching home topics:", error);
    return [];
  }
};
