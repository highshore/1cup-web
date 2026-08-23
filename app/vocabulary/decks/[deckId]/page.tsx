import VocabularyDeckClient from "./VocabularyDeckClient";

export default async function VocabularyDeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  return <VocabularyDeckClient deckId={deckId} />;
}
