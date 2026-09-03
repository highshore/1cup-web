import type { ExamCenterOverview, ExamSetDetail } from "../types";

type ApiError = { error?: string };

async function responseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(data.error || "The exam workspace could not be updated.");
  return data;
}

export async function loadExamCenter(): Promise<ExamCenterOverview> {
  const response = await fetch("/api/admin/test-center", { cache: "no-store" });
  return responseJson<ExamCenterOverview>(response);
}

export async function loadExamSet(examSetId: string): Promise<ExamSetDetail> {
  const response = await fetch(`/api/admin/test-center/${encodeURIComponent(examSetId)}`, { cache: "no-store" });
  return responseJson<ExamSetDetail>(response);
}

export async function postExamAction<T>(action: string, input: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch("/api/admin/test-center", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...input }),
  });
  return responseJson<T>(response);
}
