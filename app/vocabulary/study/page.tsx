import { requireSignedIn } from "../../lib/auth/server_guards";
import StudyDeckPicker from "./StudyDeckPicker";

export default async function VocabularyStudyIndexPage() {
  await requireSignedIn("/vocabulary/study");
  return <StudyDeckPicker />;
}
