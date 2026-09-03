import { getExamSet, noStore, requireExamAdmin } from "../../../../lib/features/exam/services/exam_admin_server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ examSetId: string }> }) {
  if (!await requireExamAdmin()) return noStore({ error: "Administrator access is required." }, 403);
  try {
    const { examSetId } = await params;
    const examSet = await getExamSet(examSetId);
    if (!examSet) return noStore({ error: "Exam set not found." }, 404);
    return noStore(examSet);
  } catch (cause) {
    console.error("[exam-center] detail load failed", cause);
    return noStore({ error: "The exam set is temporarily unavailable." }, 500);
  }
}
