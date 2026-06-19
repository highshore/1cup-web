import { db } from "../../../firebase/firebaseAdmin";

export interface HomeTopicArticle {
  id: string;
  titleEnglish: string;
  titleKorean: string;
  imageUrl?: string;
  excerpt: string;
  keywords: string[];
  timestampISO: string;
}

// Featured article IDs - UPDATE THESE WITH YOUR ACTUAL FIRESTORE ARTICLE IDs
// These should match the IDs in topics_service_client.ts
export const FEATURED_ARTICLE_IDS = [
  "Alx2pN2Wrv9jbP2MCNKo",
  "7WHMBwU9m8LtBYI2wQVA",
  "hienPf1lJL8GMBKkjnKm",
  "H1hBMM5hB7MqdXkbvvxp",
  "xI3D8ijG6Fp7UHHCvu9B",
  "Xi1YVDM6xqHYNTfnhW6X",
];

// Server-side fetch using Firebase Admin SDK - fetches specific articles by ID
export const fetchHomeTopics = async (): Promise<HomeTopicArticle[]> => {
  try {
    if (!db || !db.collection) {
      console.warn("Firebase Admin SDK not initialized, returning empty topics");
      return [];
    }

    // Fetch all featured articles in a single batched round-trip (getAll)
    // instead of N sequential reads — parallel within one session.
    const refs = FEATURED_ARTICLE_IDS.map((id) =>
      db.collection("articles").doc(id)
    );

    let docs;
    try {
      docs = await db.getAll(...refs);
    } catch (error) {
      console.error("Error batch-fetching home topics:", error);
      return [];
    }

    const topics: HomeTopicArticle[] = docs
      .filter((doc) => {
        if (!doc.exists) {
          console.warn(`Article ${doc.id} not found in Firestore`);
          return false;
        }
        return true;
      })
      .map((doc) => {
        const data = doc.data() || {};
        const contentEnglish: string[] = data.content?.english || [];
        const excerptSource =
          data.summary || data.excerpt || contentEnglish[0] || "";
        const excerpt =
          typeof excerptSource === "string"
            ? excerptSource
            : Array.isArray(excerptSource)
            ? excerptSource.join(" ")
            : "";

        const timestamp = data.timestamp?.toDate?.();

        return {
          id: doc.id,
          titleEnglish: data.title?.english || "",
          titleKorean: data.title?.korean || "",
          imageUrl: data.image_url || data.hero_image || "",
          excerpt: excerpt.slice(0, 140),
          keywords: Array.isArray(data.keywords)
            ? data.keywords.slice(0, 5)
            : [],
          timestampISO: timestamp
            ? timestamp.toISOString()
            : new Date().toISOString(),
        };
      });

    console.log(`Server: Fetched ${topics.length} topics from Firestore`);
    return topics;
  } catch (error) {
    console.error("Error fetching home topics:", error);
    return [];
  }
};
