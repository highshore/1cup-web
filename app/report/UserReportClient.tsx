"use client";

import { useEffect, useMemo, useState } from "react";
import { styled } from "styled-components";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase/client";
import { useAuth } from "../lib/contexts/auth_context";

const Container = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 0rem;
`;

const Header = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 1.5rem;
`;

const Title = styled.h1`
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0;
`;

const Subtle = styled.div`
  color: #6b7280;
  font-size: 0.9rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
`;

const Card = styled.div`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
`;

const Stat = styled.div`
  font-size: 28px;
  font-weight: 800;
  color: #111827;
`;

const Label = styled.div`
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
`;

const List = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid #eee;
  border-radius: 10px;
  background: #fff;
`;

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

  return (
    <Container>
      <Header>
        <Title>내 스피킹 리포트</Title>
        <Subtle>{reports.length}개의 세션</Subtle>
      </Header>

      <Grid>
        <Card>
          <Stat>{agg.sessions}</Stat>
          <Label>세션 수</Label>
        </Card>
        <Card>
          <Stat>{agg.totalWords.toLocaleString()}</Stat>
          <Label>총 단어 수</Label>
        </Card>
        <Card>
          <Stat>{Math.round(agg.totalSec)}s</Stat>
          <Label>총 발화 시간</Label>
        </Card>
        <Card>
          <Stat>{Math.round(agg.avgWpm)}</Stat>
          <Label>평균 WPM</Label>
        </Card>
        <Card>
          <Stat>{agg.avgOverall.toFixed(1)}/10</Stat>
          <Label>평균 종합 점수</Label>
        </Card>
      </Grid>

      <Card>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>세션 목록</div>
        {loading ? (
          <div style={{ padding: "1rem", color: "#666" }}>불러오는 중...</div>
        ) : reports.length === 0 ? (
          <div style={{ padding: "1rem", color: "#888" }}>아직 리포트가 없습니다.</div>
        ) : (
          <List>
            {reports.map((r) => (
              <Item key={r.id} onClick={() => router.push(`/transcript/${r.transcriptId}`)}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    세션 {r?.session_number || "-"}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>
                    {r?.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}
                  </div>
                </div>
                <div style={{ fontWeight: 800 }}>
                  {typeof r?.overall_score === "number" ? `${r.overall_score.toFixed(1)}/10` : "-"}
                </div>
              </Item>
            ))}
          </List>
        )}
      </Card>
    </Container>
  );
}
