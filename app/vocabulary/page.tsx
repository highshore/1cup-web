import { requireSignedIn } from "../lib/auth/server_guards";
import VocabularyHomeClient from "./VocabularyHomeClient";

export default async function VocabularyPage() {
  await requireSignedIn("/vocabulary");
  return <VocabularyHomeClient />;
}
