import VocabularyDeckV2Client from "./VocabularyDeckV2Client";

export default async function VocabularyDeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  return <VocabularyDeckV2Client deckId={deckId} />;
}
