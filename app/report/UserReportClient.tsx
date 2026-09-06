"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase/client";
import { useAuth } from "../lib/contexts/auth_context";

const cardClasses = "rounded-xl border border-[#e5e7eb] bg-white p-4";

export default function UserReportClient() {
  const router = useRouter();
  const params = useSearchParams();
  const uidParam = params.get("uid");
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);

  // Guard: only allow current user (or admin in future) to access
  useEffect(() => {
    if (!currentUser) {
      router.push("/auth?redirect=/report/user" + (uidParam ? `?uid=${uidParam}` : ""));
      return;
    }
    const targetUid = uidParam || currentUser.uid;
    if (targetUid !== currentUser.uid) {
      // Non-owner access blocked for now
      router.push("/profile");
    }
  }, [router, uidParam, currentUser]);

  // Load user's reports
  useEffect(() => {
    if (!currentUser) return;
    const targetUid = uidParam || currentUser.uid;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("speaking_reports")
        .select("*")
        .eq("user_id", targetUid)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error("Failed to load speaking reports:", error);
        setReports([]);
        setLoading(false);
        return;
      }
      const items = (data || []).map((r) => ({
        ...r,
        id: r.transcript_id,
        transcriptId: r.transcript_id,
        createdAt: r.created_at ? new Date(r.created_at) : null,
      }));
      setReports(items);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [uidParam, currentUser]);

  const agg = useMemo(() => {
    if (reports.length === 0) {
      return {
        sessions: 0,
        totalWords: 0,
        totalSec: 0,
        avgWpm: 0,
        avgOverall: 0,
      };
    }
    const sessions = reports.length;
    const totalWords = reports.reduce((s, r) => s + (r?.word_count || 0), 0);
    const totalSec = reports.reduce((s, r) => s + (r?.speaking_duration_sec || 0), 0);
    const avgWpm = totalSec > 0 ? totalWords / (totalSec / 60) : 0;
    const avgOverall = reports.reduce((s, r) => s + (r?.overall_score || 0), 0) / sessions;
    return { sessions, totalWords, totalSec, avgWpm, avgOverall };
  }, [reports]);

  const stats = [
    { value: String(agg.sessions), label: "세션 수" },
    { value: agg.totalWords.toLocaleString(), label: "총 단어 수" },
    { value: `${Math.round(agg.totalSec)}s`, label: "총 발화 시간" },
    { value: String(Math.round(agg.avgWpm)), label: "평균 WPM" },
    { value: `${agg.avgOverall.toFixed(1)}/10`, label: "평균 종합 점수" },
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-0 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="m-0 text-[1.75rem] font-extrabold">내 스피킹 리포트</h1>
        <div className="text-[0.9rem] text-[#6b7280]">{reports.length}개의 세션</div>
      </div>

      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[14px]">
        {stats.map((stat) => (
          <div key={stat.label} className={cardClasses}>
            <div className="text-[28px] font-extrabold text-[#111827]">{stat.value}</div>
            <div className="mt-1 text-[12px] text-[#6b7280]">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className={cardClasses}>
        <div className="mb-3 font-bold">세션 목록</div>
        {loading ? (
          <div className="p-4 text-[#666]">불러오는 중...</div>
        ) : reports.length === 0 ? (
          <div className="p-4 text-[#888]">아직 리포트가 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {reports.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-[10px] border border-[#eee] bg-white px-3.5 py-3"
                onClick={() => router.push(`/transcript/${r.transcriptId}`)}
              >
                <div>
                  <div className="font-bold">
                    세션 {r?.session_number || "-"}
                  </div>
                  <div className="text-[12px] text-[#6b7280]">
                    {r?.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}
                  </div>
                </div>
                <div className="font-extrabold">
                  {typeof r?.overall_score === "number" ? `${r.overall_score.toFixed(1)}/10` : "-"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
