import "server-only";

import { cache } from "react";

import { admin } from "../supabase/server";

export interface MeetupSeoRecord {
  id: string;
  title: string;
  description: string;
  dateTimeISO: string | null;
  locationName: string;
  locationAddress: string;
  latitude: number | null;
  longitude: number | null;
  durationMinutes: number;
  imageUrls: string[];
}

export interface MeetupSitemapRecord {
  id: string;
  dateTimeISO: string | null;
}

const toDateIso = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toFiniteNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const fetchMeetupSeoByIdServer = cache(
  async (id: string): Promise<MeetupSeoRecord | null> => {
    const meetupId = id.trim();
    if (!meetupId) return null;

    const { data, error } = await admin()
      .from("meetups")
      .select(
        "id,title,description,date_time,location_name,location_address,latitude,longitude,duration_minutes,image_urls",
      )
      .eq("id", meetupId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      title: String(row.title || ""),
      description: String(row.description || ""),
      dateTimeISO: toDateIso(row.date_time),
      locationName: String(row.location_name || ""),
      locationAddress: String(row.location_address || ""),
      latitude: toFiniteNumber(row.latitude),
      longitude: toFiniteNumber(row.longitude),
      durationMinutes: Math.max(0, Number(row.duration_minutes) || 0),
      imageUrls: Array.isArray(row.image_urls) ? row.image_urls.map(String) : [],
    };
  },
);

export async function fetchMeetupSitemapRecordsServer(): Promise<
  MeetupSitemapRecord[]
> {
  try {
    const { data, error } = await admin()
      .from("meetups")
      .select("id,date_time")
      .order("date_time", { ascending: false })
      .limit(500);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: String(row.id),
      dateTimeISO: toDateIso(row.date_time),
    }));
  } catch (error) {
    console.error("Error fetching meetup sitemap records:", error);
    return [];
  }
}

export const publishedArticleExistsServer = cache(async (id: string) => {
  const articleId = id.trim();
  if (!articleId) return false;

  const { data, error } = await admin()
    .from("articles")
    .select("id")
    .eq("id", articleId)
    .eq("publication_status", "published")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
});
