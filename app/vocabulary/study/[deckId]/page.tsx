import VocabularyStudyClient from "./VocabularyStudyClient";

export default async function VocabularyStudyPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  return <VocabularyStudyClient deckId={deckId} />;
}
