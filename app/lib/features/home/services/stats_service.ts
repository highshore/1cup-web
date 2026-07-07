import { admin } from "../../../supabase/server";

export interface HomeStats {
  totalMeetups: number;
  totalMembers: number;
  totalArticles: number;
}

export const fetchHomeStats = async (): Promise<HomeStats> => {
  try {
    // The old `cache/homeStats` doc + count logic is now the `home_stats` VIEW.
    // Read it directly instead of counting collections client-side.
    const { data, error } = await admin()
      .from("home_stats")
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Error fetching home stats:", error);
      return {
        totalMeetups: 0,
        totalMembers: 0,
        totalArticles: 0,
      };
    }

    const stats: HomeStats = {
      totalMeetups: data?.total_meetups ?? 0,
      totalMembers: data?.total_members ?? 0,
      totalArticles: data?.total_articles ?? 0,
    };

    console.log("Home stats fetched:", stats);
    return stats;
  } catch (error) {
    console.error("Error fetching home stats:", error);
    return {
      totalMeetups: 0,
      totalMembers: 0,
      totalArticles: 0,
    };
  }
};
