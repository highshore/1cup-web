"use client";

import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";

import {
  GrowthPost,
  GrowthIteration,
  GrowthConfig,
  GROWTH_CHANNEL_LABELS,
} from "../types/growth_types";
import {
  fetchGrowthPosts,
  fetchGrowthIterations,
  fetchGrowthConfig,
  updateGrowthConfig,
  updateGrowthPostStatus,
  deleteGrowthPost,
} from "../services/growth_service";

const Section = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  margin-bottom: 20px;
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 16px;
`;

const ControlRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
`;

const Toggle = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid ${({ $on }) => ($on ? "#16a34a" : "#d1d5db")};
  background: ${({ $on }) => ($on ? "#dcfce7" : "#f9fafb")};
  color: ${({ $on }) => ($on ? "#166534" : "#6b7280")};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
`;

const StatBox = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 16px;
`;

const StatNumber = styled.div`
  font-size: 24px;
  font-weight: 800;
  color: #1f2937;
`;

const StatLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
`;

const PostCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
`;

const PostTop = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
`;

const Badge = styled.span<{ $bg: string; $fg: string }>`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: ${({ $bg }) => $bg};
  color: ${({ $fg }) => $fg};
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 700;
`;

const Chip = styled.span`
  display: inline-flex;
  border-radius: 6px;
  background: #f3f4f6;
  color: #4b5563;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
`;

const PostContent = styled.p`
  margin: 8px 0;
  color: #374151;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
`;

const MetricRow = styled.div`
  display: flex;
  gap: 18px;
  margin: 10px 0;
  font-size: 13px;
  color: #4b5563;

  strong {
    color: #1f2937;
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const ActionButton = styled.button<{ $variant?: "primary" | "danger" }>`
  border: 1px solid
    ${({ $variant }) =>
      $variant === "danger"
        ? "#fca5a5"
        : $variant === "primary"
        ? "#2c1810"
        : "#d1d5db"};
  background: ${({ $variant }) =>
    $variant === "danger"
      ? "#fef2f2"
      : $variant === "primary"
      ? "#2c1810"
      : "#ffffff"};
  color: ${({ $variant }) =>
    $variant === "danger"
      ? "#b91c1c"
      : $variant === "primary"
      ? "#ffffff"
      : "#374151"};
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const IterationItem = styled.div`
  border-left: 3px solid #2c1810;
  padding: 4px 0 4px 14px;
  margin-bottom: 16px;

  .when {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 600;
  }
  .obs,
  .dec {
    font-size: 13px;
    color: #374151;
    margin: 4px 0;
  }
  .label {
    font-weight: 700;
    color: #1f2937;
  }
`;

const Empty = styled.div`
  color: #9ca3af;
  font-size: 14px;
  padding: 8px 0;
`;

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#fef9c3", fg: "#854d0e" },
  approved: { bg: "#dbeafe", fg: "#1e40af" },
  posted: { bg: "#dcfce7", fg: "#166534" },
  rejected: { bg: "#fee2e2", fg: "#991b1b" },
  failed: { bg: "#fee2e2", fg: "#991b1b" },
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const GrowthDashboard: React.FC = () => {
  const [posts, setPosts] = useState<GrowthPost[]>([]);
  const [iterations, setIterations] = useState<GrowthIteration[]>([]);
  const [config, setConfig] = useState<GrowthConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, it, cfg] = await Promise.all([
      fetchGrowthPosts(),
      fetchGrowthIterations(),
      fetchGrowthConfig(),
    ]);
    setPosts(p);
    setIterations(it);
    setConfig(cfg);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleConfig = async (key: "agentActive" | "approveFirst") => {
    if (!config) return;
    const next = { ...config, [key]: !config[key] };
    setConfig(next); // optimistic
    await updateGrowthConfig({ [key]: next[key] });
  };

  const setStatus = async (
    post: GrowthPost,
    status: GrowthPost["status"]
  ) => {
    let externalUrl: string | undefined;
    if (status === "posted") {
      externalUrl =
        window.prompt("게시된 글의 URL을 입력하세요 (선택):", post.externalUrl) ||
        undefined;
    }
    await updateGrowthPostStatus(post.id, status, { externalUrl });
    await load();
  };

  const remove = async (post: GrowthPost) => {
    if (!window.confirm("이 게시물을 삭제하시겠습니까?")) return;
    await deleteGrowthPost(post.id);
    await load();
  };

  const totals = posts.reduce(
    (acc, p) => {
      acc.clicks += p.metrics.clicks || 0;
      acc.signups += p.metrics.signups || 0;
      if (p.status === "posted") acc.posted += 1;
      return acc;
    },
    { clicks: 0, signups: 0, posted: 0 }
  );

  if (loading) return <Section>Loading growth data…</Section>;

  return (
    <div>
      <Section>
        <SectionTitle>Growth Agent</SectionTitle>
        <ControlRow>
          <Toggle
            $on={!!config?.agentActive}
            onClick={() => toggleConfig("agentActive")}
          >
            {config?.agentActive ? "● 에이전트 실행 중" : "○ 에이전트 정지됨"}
          </Toggle>
          <Toggle
            $on={!!config?.approveFirst}
            onClick={() => toggleConfig("approveFirst")}
          >
            {config?.approveFirst
              ? "승인 후 게시 (approve-first)"
              : "자동 게시"}
          </Toggle>
          <ActionButton onClick={load}>새로고침</ActionButton>
        </ControlRow>
      </Section>

      <Section>
        <SectionTitle>Performance</SectionTitle>
        <StatsGrid>
          <StatBox>
            <StatNumber>{posts.length}</StatNumber>
            <StatLabel>Total posts</StatLabel>
          </StatBox>
          <StatBox>
            <StatNumber>{totals.posted}</StatNumber>
            <StatLabel>Posted</StatLabel>
          </StatBox>
          <StatBox>
            <StatNumber>{totals.clicks}</StatNumber>
            <StatLabel>Tracked clicks</StatLabel>
          </StatBox>
          <StatBox>
            <StatNumber>{totals.signups}</StatNumber>
            <StatLabel>Attributed signups</StatLabel>
          </StatBox>
        </StatsGrid>
      </Section>

      <Section>
        <SectionTitle>Posts ({posts.length})</SectionTitle>
        {posts.length === 0 ? (
          <Empty>
            아직 게시물이 없습니다. 에이전트가 초안을 생성하면 여기에 표시됩니다.
          </Empty>
        ) : (
          posts.map((post) => {
            const s = STATUS_STYLES[post.status] || STATUS_STYLES.draft;
            return (
              <PostCard key={post.id}>
                <PostTop>
                  <Badge $bg="#eef2ff" $fg="#3730a3">
                    {GROWTH_CHANNEL_LABELS[post.channel] || post.channel}
                  </Badge>
                  <Badge $bg={s.bg} $fg={s.fg}>
                    {post.status}
                  </Badge>
                  {Object.entries(post.variant || {})
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <Chip key={k}>
                        {k}: {v}
                      </Chip>
                    ))}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
                    {fmtDate(post.createdAt)}
                  </span>
                </PostTop>
                {post.title && (
                  <strong style={{ color: "#1f2937" }}>{post.title}</strong>
                )}
                <PostContent>{post.content}</PostContent>
                <MetricRow>
                  <span>
                    Clicks <strong>{post.metrics.clicks}</strong>
                  </span>
                  <span>
                    Signups <strong>{post.metrics.signups}</strong>
                  </span>
                  <span>
                    Code <strong>{post.trackingCode}</strong>
                  </span>
                  {post.externalUrl && (
                    <a href={post.externalUrl} target="_blank" rel="noreferrer">
                      게시물 보기 ↗
                    </a>
                  )}
                </MetricRow>
                <Actions>
                  {post.status === "draft" && (
                    <>
                      <ActionButton
                        $variant="primary"
                        onClick={() => setStatus(post, "approved")}
                      >
                        승인
                      </ActionButton>
                      <ActionButton onClick={() => setStatus(post, "rejected")}>
                        거절
                      </ActionButton>
                    </>
                  )}
                  {(post.status === "approved" || post.status === "draft") && (
                    <ActionButton onClick={() => setStatus(post, "posted")}>
                      게시됨으로 표시
                    </ActionButton>
                  )}
                  <ActionButton $variant="danger" onClick={() => remove(post)}>
                    삭제
                  </ActionButton>
                </Actions>
              </PostCard>
            );
          })
        )}
      </Section>

      <Section>
        <SectionTitle>Agent activity ({iterations.length})</SectionTitle>
        {iterations.length === 0 ? (
          <Empty>
            아직 에이전트 실행 기록이 없습니다. 매 실행마다 관찰·결정·전략 변경이
            여기에 기록됩니다.
          </Empty>
        ) : (
          iterations.map((it) => (
            <IterationItem key={it.id}>
              <div className="when">
                {fmtDate(it.runAt)} ·{" "}
                {GROWTH_CHANNEL_LABELS[it.channel] || it.channel}
                {it.model ? ` · ${it.model}` : ""}
              </div>
              {it.observation && (
                <div className="obs">
                  <span className="label">관찰:</span> {it.observation}
                </div>
              )}
              {it.decision && (
                <div className="dec">
                  <span className="label">결정:</span> {it.decision}
                </div>
              )}
              {it.strategyChange && (
                <div className="dec">
                  <span className="label">전략 변경:</span> {it.strategyChange}
                </div>
              )}
            </IterationItem>
          ))
        )}
      </Section>
    </div>
  );
};

export default GrowthDashboard;
