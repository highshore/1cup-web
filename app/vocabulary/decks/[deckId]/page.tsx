import { requireSignedIn } from "../../../lib/auth/server_guards";
import VocabularyDeckV2Client from "./VocabularyDeckV2Client";

export default async function VocabularyDeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  await requireSignedIn(`/vocabulary/decks/${deckId}`);
  return <VocabularyDeckV2Client deckId={deckId} />;
}
