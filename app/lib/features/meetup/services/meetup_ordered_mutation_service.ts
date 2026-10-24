import { supabase } from "../../../supabase/client";
import type { FirestoreMeetupEvent } from "../types/meetup_types";
import {
  createMeetupEvent as createMeetupEventLegacy,
  updateMeetupEvent as updateMeetupEventLegacy,
} from "./meetup_service_legacy";

type MeetupMutationData = Partial<FirestoreMeetupEvent> & {
  articles?: string[];
};

async function persistArticlePositions(
  eventId: string,
  articleIds: string[],
): Promise<void> {
  if (articleIds.length === 0) return;

  const { error } = await supabase.from("meetup_articles").upsert(
    articleIds.map((articleId, position) => ({
      meetup_id: eventId,
      article_id: articleId,
      position,
    })),
    { onConflict: "meetup_id,article_id" },
  );

  if (error) throw error;
}

// Keep the existing meetup mutation behavior, then persist the semantic order of
// article IDs exactly as the admin selected them in the dialog.
export async function createMeetupEvent(
  eventData: MeetupMutationData,
  creatorUid: string,
): Promise<string> {
  const eventId = await createMeetupEventLegacy(eventData, creatorUid);
  await persistArticlePositions(eventId, eventData.articles || []);
  return eventId;
}

export async function updateMeetupEvent(
  eventId: string,
  eventData: MeetupMutationData,
): Promise<void> {
  await updateMeetupEventLegacy(eventId, eventData);

  if (Array.isArray(eventData.articles)) {
    await persistArticlePositions(eventId, eventData.articles);
  }
}
