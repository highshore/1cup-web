"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "../../lib/contexts/auth_context";
import { invokeFunction, supabase } from "../../lib/supabase/client";

type RefundableOrder = {
  order_number: string;
  amount: number;
  list_amount: number | null;
  discount_amount: number | null;
  region: "anam" | "yeouido" | null;
  completed_at: string | null;
  status: string;
  quote?: {
    refundable: boolean;
    creditsPurchased: number;
    creditsRemaining: number;
    refundAmount: number;
    expiresAt: string | null;
    message: string;
  };
};

export default function ParticipationRefundClient() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<RefundableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await supabase
        .from("payment_orders")
        .select("order_number, amount, list_amount, discount_amount, region, completed_at, status")
        .eq("type", "participation_pack_purchase")
        .in("status", ["completed", "partially_refunded", "refunded"])
        .order("completed_at", { ascending: false });
      if (error) throw error;

      const quoted = await Promise.all((data ?? []).map(async (order: any) => {
        if (order.status !== "completed") return order as RefundableOrder;
        try {
          const quote = await invokeFunction<any>("checkout", {
            action: "participation-refund-quote",
            orderNumber: order.order_number,
          });
          return { ...order, quote } as RefundableOrder;
        } catch {
          return order as RefundableOrder;
        }
      }));
      setOrders(quoted);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "환불 내역을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { void load(); }, [load]);

  const refund = async (order: RefundableOrder) => {
    if (!order.quote?.refundable) return;
    const ok = window.confirm(
      `남은 ${order.quote.creditsRemaining}회 이용권을 반환하고 ${order.quote.refundAmount.toLocaleString()}원을 환불할까요?`,
    );
    if (!ok) return;

    setProcessing(order.order_number);
    setMessage("");
    try {
      const result = await invokeFunction<any>("checkout", {
        action: "refund-participation-pack",
        orderNumber: order.order_number,
        reason: "Member requested proportional participation-pack refund",
      });
      setMessage(`${Number(result.refundAmount || 0).toLocaleString()}원 환불이 접수되었습니다. 남은 이용권: ${Number(result.creditBalance || 0)}회`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "환불을 처리하지 못했습니다.");
    } finally {
      setProcessing(null);
    }
  };

  if (!currentUser) {
    return (
      <main style={{ maxWidth: 720, margin: "72px auto", padding: "0 18px" }}>
        <h1>5회 이용권 환불</h1>
        <p>로그인 후 구매 내역을 확인할 수 있습니다.</p>
        <Link href="/auth">로그인하기</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: "56px auto", padding: "0 18px 72px" }}>
      <h1 style={{ marginBottom: 8 }}>5회 이용권 환불</h1>
      <p style={{ color: "#666", lineHeight: 1.6 }}>
        유효기간 내 실제 결제금액 × 남은 횟수 ÷ 5로 환불됩니다. 사용한 횟수만큼은 차감되며,
        추천 할인으로 구매했다면 할인된 실제 결제금액을 기준으로 계산합니다.
      </p>
      <p><Link href="/profile">← 프로필로 돌아가기</Link></p>

      {message ? <div style={{ padding: 12, margin: "16px 0", border: "1px solid #bbb", borderRadius: 10 }}>{message}</div> : null}
      {loading ? <p>구매 내역을 확인하는 중...</p> : null}

      <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
        {!loading && orders.length === 0 ? <p>5회 이용권 구매 내역이 없습니다.</p> : null}
        {orders.map((order) => {
          const region = order.region === "yeouido" ? "여의도" : "안암";
          const completed = order.completed_at ? new Date(order.completed_at).toLocaleDateString("ko-KR") : "-";
          const quote = order.quote;
          return (
            <section key={order.order_number} style={{ border: "2px solid #111", borderRadius: 14, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <strong>{region} 5회 이용권</strong>
                  <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>{completed} 결제 · {Number(order.amount).toLocaleString()}원</div>
                </div>
                <span style={{ fontSize: 13 }}>{order.status === "completed" ? "이용 중" : "환불 완료"}</span>
              </div>
              {quote ? (
                <div style={{ marginTop: 14, lineHeight: 1.65 }}>
                  <div>남은 횟수: <strong>{quote.creditsRemaining}/{quote.creditsPurchased}회</strong></div>
                  <div>예상 환불액: <strong>{quote.refundAmount.toLocaleString()}원</strong></div>
                  <div style={{ color: "#666", fontSize: 13 }}>{quote.message}</div>
                  <button
                    type="button"
                    disabled={!quote.refundable || processing === order.order_number}
                    onClick={() => void refund(order)}
                    style={{ marginTop: 12, padding: "10px 16px", border: "2px solid #111", borderRadius: 999, background: "#f47a4a", fontWeight: 800, cursor: quote.refundable ? "pointer" : "not-allowed" }}
                  >
                    {processing === order.order_number ? "환불 처리 중..." : "남은 횟수 환불"}
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>이 주문은 더 이상 환불할 수 없습니다.</div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
