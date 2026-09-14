"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import { invokeFunction, supabase } from "../lib/supabase/client";

const PAYPLE_HOST = (process.env.NEXT_PUBLIC_PAYPLE_HOST || "https://cpay.payple.kr").replace(/\/+$/, "");
const PAYPLE_SDK_SRC = `${PAYPLE_HOST}/js/v1/payment.js`;

type Region = "anam" | "yeouido";
type ProductId = "membership_30d" | "participation_pack_5";

type PaymentProduct = {
  id: ProductId;
  region: Region;
  displayName: string;
  price: number;
  referralPrice: number;
  referralDiscountAmount: number;
  recurring: boolean;
  credits?: number;
  validityDays?: number;
};

type QuoteResult = {
  success: boolean;
  validReferral: boolean;
  listAmount: number;
  discountAmount: number;
  finalAmount: number;
  message: string;
};

declare global {
  interface Window {
    PaypleCpayAuthCheck?: (paymentParams: Record<string, unknown>) => void;
    $?: unknown;
    PaypleCpayCallback?: Array<(response: Record<string, any>) => boolean>;
  }
}

const formatWon = (value?: number) =>
  value === undefined ? "—" : `₩${value.toLocaleString()}`;

const StatusMessage = ({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) => (
  <p
    className={`mt-2 text-[12px] font-medium leading-[1.55] ${
      error ? "text-[#b42318]" : "text-[#16794f]"
    }`}
  >
    {children}
  </p>
);

export default function RegionalPaymentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const { t } = useI18n();
  const copy = t.payment;

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<PaymentProduct[]>([]);
  const [region, setRegion] = useState<Region>("anam");
  const [productId, setProductId] = useState<ProductId | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [checkingReferral, setCheckingReferral] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const referralInputRef = useRef<HTMLInputElement>(null);

  const membershipProduct = useMemo(
    () => products.find((p) => p.id === "membership_30d" && p.region === region),
    [products, region],
  );
  const flexProduct = useMemo(
    () => products.find((p) => p.id === "participation_pack_5" && p.region === region),
    [products, region],
  );
  const selectedProduct = useMemo(
    () =>
      productId
        ? products.find((p) => p.id === productId && p.region === region)
        : undefined,
    [products, productId, region],
  );

  const isPack = productId === "participation_pack_5";
  const regionLabel = copy.locations[region];
  const discount = quote?.validReferral ? quote.discountAmount : 0;
  const totalAmount = quote?.validReferral
    ? quote.finalAmount
    : selectedProduct?.price;

  const resetReferralApplication = () => {
    setAppliedReferralCode(null);
    setQuote(null);
    setMessage("");
    setError("");
  };

  const selectRegion = (nextRegion: Region) => {
    setRegion(nextRegion);
    setProductId(null);
    setCheckoutOpen(false);
    setProcessing(false);
    resetReferralApplication();
  };

  const openCheckout = (nextProduct: ProductId, focusReferral = false) => {
    if (nextProduct === "membership_30d" && alreadySubscribed) return;
    setProductId(nextProduct);
    setCheckoutOpen(true);
    setProcessing(false);
    resetReferralApplication();
    if (focusReferral) {
      window.setTimeout(() => referralInputRef.current?.focus(), 80);
    }
  };

  const closeCheckout = () => {
    if (processing) return;
    setCheckoutOpen(false);
    setMessage("");
    setError("");
  };

  useEffect(() => {
    const urlRef = searchParams?.get("ref")?.trim();
    const shouldResume = searchParams?.get("resume") === "1";
    const urlRegion = searchParams?.get("region");
    const urlProduct = searchParams?.get("product");

    if (urlRef) setReferralCode(urlRef);
    if (urlRegion === "anam" || urlRegion === "yeouido") setRegion(urlRegion);
    if (
      shouldResume &&
      (urlProduct === "membership_30d" || urlProduct === "participation_pack_5")
    ) {
      setProductId(urlProduct);
      setCheckoutOpen(true);
    }

    if (typeof window !== "undefined" && !urlRef) {
      const stored = sessionStorage.getItem("referralCodePrefill")?.trim();
      if (stored) setReferralCode(stored);
      sessionStorage.removeItem("referralCodePrefill");
    }
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      try {
        const result = await invokeFunction<{
          success: boolean;
          products: PaymentProduct[];
        }>("checkout", { action: "products" });
        setProducts(result.products || []);
        if (currentUser) {
          const { data } = await supabase
            .from("users")
            .select("has_active_subscription")
            .eq("uid", currentUser.uid)
            .maybeSingle();
          setAlreadySubscribed(Boolean(data?.has_active_subscription));
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : copy.states.loadFailed,
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [copy.states.loadFailed, currentUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.PaypleCpayCallback = window.PaypleCpayCallback || [];

    const callback = (response: Record<string, any>) => {
      const session = sessionStorage.getItem("paymentSessionInfo");
      if (!session) {
        window.location.href = "/payment/result";
        return true;
      }
      const parsed = JSON.parse(session) as { userId: string };
      void invokeFunction("checkout", {
        action: "verify",
        userId: parsed.userId,
        paymentParams: response,
      })
        .then((result) =>
          sessionStorage.setItem(
            "paymentVerificationResult",
            JSON.stringify(result),
          ),
        )
        .catch((err) =>
          sessionStorage.setItem(
            "paymentVerificationError",
            JSON.stringify({ message: err?.message || String(err) }),
          ),
        )
        .finally(() => {
          window.location.href = "/payment/result";
        });
      return true;
    };

    window.PaypleCpayCallback.push(callback);

    const appendPayple = () => {
      if (document.querySelector(`script[src="${PAYPLE_SDK_SRC}"]`)) return;
      const script = document.createElement("script");
      script.src = PAYPLE_SDK_SRC;
      script.async = true;
      document.body.appendChild(script);
    };

    if (!window.$) {
      const existing = document.querySelector(
        'script[src="https://code.jquery.com/jquery-3.6.0.min.js"]',
      ) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", appendPayple, { once: true });
      } else {
        const jquery = document.createElement("script");
        jquery.src = "https://code.jquery.com/jquery-3.6.0.min.js";
        jquery.async = true;
        jquery.onload = appendPayple;
        document.body.appendChild(jquery);
      }
    } else {
      appendPayple();
    }

    return () => {
      window.PaypleCpayCallback = (window.PaypleCpayCallback || []).filter(
        (item) => item !== callback,
      );
    };
  }, []);

  useEffect(() => {
    if (!checkoutOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !processing) closeCheckout();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [checkoutOpen, processing]);

  const applyReferral = async () => {
    const code = referralCode.trim();
    if (!code || !selectedProduct || !productId) return;

    if (!currentUser) {
      sessionStorage.setItem("referralCodePrefill", code);
      localStorage.setItem(
        "returnUrl",
        `/payment?resume=1&region=${region}&product=${productId}&ref=${encodeURIComponent(code)}`,
      );
      router.push("/auth");
      return;
    }

    setCheckingReferral(true);
    setError("");
    setMessage("");
    try {
      const result = await invokeFunction<QuoteResult>("checkout", {
        action: "quote",
        productId,
        region,
        referralCode: code,
      });
      setQuote(result);
      if (result.validReferral) {
        setAppliedReferralCode(code);
      } else {
        setAppliedReferralCode(null);
      }
      setMessage(result.message);
    } catch (err) {
      setAppliedReferralCode(null);
      setQuote(null);
      setError(
        err instanceof Error ? err.message : copy.states.referralFailed,
      );
    } finally {
      setCheckingReferral(false);
    }
  };

  const handlePayment = async () => {
    if (!productId) return;

    if (!currentUser) {
      localStorage.setItem(
        "returnUrl",
        `/payment?resume=1&region=${region}&product=${productId}`,
      );
      if (referralCode.trim()) {
        sessionStorage.setItem("referralCodePrefill", referralCode.trim());
      }
      router.push("/auth");
      return;
    }
    if (!selectedProduct || totalAmount === undefined) {
      setError(copy.states.paymentInfoLoading);
      return;
    }
    if (productId === "membership_30d" && alreadySubscribed) {
      setError(copy.states.duplicateMembership);
      return;
    }

    setProcessing(true);
    setError("");
    try {
      const paymentData = await invokeFunction<any>("checkout", {
        action: "window",
        userId: currentUser.uid,
        userEmail: currentUser.email || "",
        userName: currentUser.displayName || "사용자",
        productId,
        region,
        referralCode: appliedReferralCode || undefined,
      });
      if (!paymentData?.success) {
        throw new Error(paymentData?.message || copy.states.paymentInfoLoading);
      }
      if (typeof window.PaypleCpayAuthCheck !== "function") {
        throw new Error(copy.states.paymentScriptLoading);
      }

      sessionStorage.setItem(
        "paymentSessionInfo",
        JSON.stringify({
          userId: currentUser.uid,
          productId,
          region,
          orderNumber: paymentData.orderNumber,
          timestamp: Date.now(),
        }),
      );
      window.PaypleCpayAuthCheck(paymentData.paymentParams);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : copy.states.paymentStartFailed,
      );
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-74px)] bg-[#f5f5f5] px-5 py-16">
        <div className="mx-auto w-full max-w-[560px] rounded-[20px] border border-[#dbdbd6] bg-white p-8 text-center text-[14px] font-semibold text-[#64748b]">
          {copy.states.loading}
        </div>
      </main>
    );
  }

  const membershipPrice = membershipProduct?.price;
  const flexPrice = flexProduct?.price;

  return (
    <main className="min-h-[calc(100vh-74px)] bg-[#f5f5f5] px-5 py-[54px] text-[#050505] max-[768px]:px-4 max-[768px]:py-8">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-7">
        <section className="flex min-h-[128px] items-end justify-between gap-8 max-[720px]:min-h-0 max-[720px]:flex-col max-[720px]:items-start">
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[12px] font-bold text-[#f47a4a]">
              {copy.eyebrow}
            </p>
            <h1 className="m-0 font-['Noto_Sans_KR',sans-serif] text-[42px] font-black leading-[1.24] tracking-[-0.035em] text-[#050505] max-[720px]:text-[34px] max-[480px]:text-[30px]">
              {copy.title}
            </h1>
            <p className="m-0 text-[15px] leading-6 text-[#64748b]">
              {copy.subtitle}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 max-[720px]:items-start">
            <p className="m-0 text-[12px] font-bold text-[#64748b]">
              {copy.locationLabel}
            </p>
            <div className="flex gap-1 rounded-[22px] bg-[#eaeae8] p-1">
              {(["anam", "yeouido"] as Region[]).map((location) => (
                <button
                  key={location}
                  type="button"
                  onClick={() => selectRegion(location)}
                  className={`h-9 min-w-[76px] rounded-[18px] px-4 text-[13px] font-bold transition-colors ${
                    region === location
                      ? "bg-[#050505] text-white"
                      : "text-[#050505] hover:bg-white/70"
                  }`}
                  aria-pressed={region === location}
                >
                  {copy.locations[location]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-[430px_minmax(0,1fr)] gap-11 rounded-[28px] border-2 border-[#050505] bg-white p-[34px] shadow-[6px_6px_0_rgba(5,5,5,0.13)] max-[900px]:grid-cols-1 max-[900px]:gap-8 max-[600px]:rounded-[22px] max-[600px]:p-5">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="relative h-[254px] w-full overflow-hidden rounded-[24px] border-2 border-[#050505] bg-[#f47a4a] shadow-[4px_4px_0_rgba(5,5,5,0.95)]">
              <div className="absolute -right-[78px] -top-[54px] h-[210px] w-[210px] rounded-full bg-white/25" />
              <div className="absolute -bottom-1 -right-0 h-24 w-24 rounded-full bg-white/20" />
              <p className="absolute left-[22px] top-5 m-0 text-[15px] font-extrabold">
                1 CUP ENGLISH
              </p>
              <div className="absolute right-[26px] top-4 flex h-7 min-w-[68px] items-center justify-center rounded-[14px] border border-[#050505] bg-white/90 px-3 text-[12px] font-bold">
                {regionLabel}
              </div>
              <p className="absolute left-[22px] top-[74px] m-0 text-[13px] font-bold">
                {copy.membership.label}
              </p>
              <p className="absolute left-5 top-[94px] m-0 text-[36px] font-black leading-none tracking-[-0.02em]">
                {copy.membership.name}
              </p>
              <div className="absolute bottom-[38px] left-5 flex items-end gap-2">
                <p className="m-0 text-[34px] font-black leading-none tracking-[-0.035em]">
                  {formatWon(membershipPrice)}
                </p>
                <p className="m-0 pb-[2px] text-[13px] font-bold">/ 30일</p>
              </div>
              <p className="absolute bottom-[10px] left-[22px] m-0 text-[11px] font-medium">
                {copy.membership.renewal}
              </p>
            </div>

            <button
              type="button"
              onClick={() => openCheckout("membership_30d")}
              disabled={!membershipProduct || alreadySubscribed}
              className="flex h-[52px] w-full items-center justify-center rounded-[26px] bg-[#050505] px-5 text-[15px] font-bold text-white shadow-[4px_4px_0_#f47a4a] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
            >
              {alreadySubscribed
                ? copy.membership.activeCta
                : `${copy.membership.cta}  →`}
            </button>
            <p className="m-0 text-center text-[11px] text-[#64748b]">
              {copy.membership.renewalNote}
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <p className="m-0 text-[11px] font-bold text-[#f47a4a]">
              {copy.membership.benefitsEyebrow}
            </p>
            <h2 className="m-0 font-['Noto_Sans_KR',sans-serif] text-[27px] font-black leading-9 tracking-[-0.025em] text-[#050505]">
              {copy.membership.benefitsTitle}
            </h2>
            <p className="m-0 text-[13px] leading-5 text-[#64748b]">
              {copy.membership.benefitsSubtitle}
            </p>

            <div className="h-2" />
            {[
              [copy.membership.benefitOneTitle, copy.membership.benefitOneBody],
              [copy.membership.benefitTwoTitle, copy.membership.benefitTwoBody],
              [copy.membership.benefitThreeTitle, copy.membership.benefitThreeBody],
            ].map(([title, body]) => (
              <div key={title} className="flex min-h-[66px] gap-3.5">
                <div className="mt-px flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#f47a4a] bg-[#fff0e8] text-[13px] font-bold text-[#f47a4a]">
                  ✓
                </div>
                <div className="min-w-0">
                  <p className="m-0 text-[15px] font-bold leading-5 text-[#050505]">
                    {title}
                  </p>
                  <p className="mt-[3px] text-[12px] leading-[18px] text-[#64748b]">
                    {body}
                  </p>
                </div>
              </div>
            ))}

            <div className="h-px w-full bg-[#e6e6e6]" />
            <div className="flex min-h-[38px] items-center justify-between gap-4 text-[12px]">
              <p className="m-0 font-medium text-[#64748b]">
                {copy.referralPrompt}
              </p>
              <button
                type="button"
                onClick={() =>
                  openCheckout(
                    alreadySubscribed ? "participation_pack_5" : "membership_30d",
                    true,
                  )
                }
                disabled={alreadySubscribed ? !flexProduct : !membershipProduct}
                className="shrink-0 font-bold text-[#f47a4a] hover:underline disabled:opacity-45"
              >
                {copy.referralPromptCta}
              </button>
            </div>
            {alreadySubscribed ? (
              <p className="m-0 text-[11px] leading-[1.55] text-[#64748b]">
                {copy.membership.alreadyActive}
              </p>
            ) : null}
          </div>
        </section>

        <section className="flex min-h-[142px] items-center justify-between gap-8 rounded-[22px] border-[1.5px] border-[#dadada] bg-white px-7 py-6 max-[720px]:flex-col max-[720px]:items-stretch max-[720px]:gap-5">
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-bold text-[#f47a4a]">
              {copy.flex.eyebrow}
            </p>
            <h2 className="mt-1 font-['Noto_Sans_KR',sans-serif] text-[21px] font-black leading-7 tracking-[-0.02em] text-[#050505]">
              {copy.flex.title}
            </h2>
            <p className="mt-1 text-[12px] text-[#64748b]">
              {copy.flex.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-6 max-[720px]:justify-between max-[480px]:flex-col max-[480px]:items-stretch max-[480px]:gap-3">
            <div className="text-right max-[480px]:text-left">
              <p className="m-0 text-[25px] font-black leading-none">
                {formatWon(flexPrice)}
              </p>
              <p className="mt-1 text-[11px] text-[#64748b]">
                {copy.flex.oneTime}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openCheckout("participation_pack_5")}
              disabled={!flexProduct}
              className="h-11 min-w-[172px] rounded-[22px] border-2 border-[#050505] bg-white px-5 text-[13px] font-bold text-[#050505] transition-colors hover:bg-[#f8f8f6] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copy.flex.cta}
            </button>
          </div>
        </section>

        <div className="flex min-h-[30px] items-center justify-center gap-4 text-[11px] text-[#64748b] max-[480px]:gap-2 max-[480px]:text-[10px]">
          <span>{copy.trust.secure}</span>
          <span aria-hidden="true">•</span>
          <a href="/policy/refund" className="hover:text-[#050505] hover:underline">
            {copy.trust.refund}
          </a>
          <span aria-hidden="true">•</span>
          <a href="/policy/terms" className="hover:text-[#050505] hover:underline">
            {copy.trust.terms}
          </a>
        </div>

        {!checkoutOpen && error ? <StatusMessage error>{error}</StatusMessage> : null}
      </div>

      {checkoutOpen && selectedProduct && productId && totalAmount !== undefined ? (
        <div className="fixed inset-0 z-[120]" role="presentation">
          <button
            type="button"
            aria-label={copy.checkout.close}
            onClick={closeCheckout}
            className="absolute inset-0 h-full w-full cursor-default bg-[#050505]/25"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-checkout-title"
            className="absolute right-0 top-0 flex h-full w-[520px] max-w-full flex-col overflow-y-auto bg-white px-9 py-9 shadow-[-10px_0_24px_rgba(0,0,0,0.16)] max-[600px]:w-full max-[600px]:px-5 max-[600px]:py-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h2
                id="payment-checkout-title"
                className="m-0 font-['Noto_Sans_KR',sans-serif] text-[28px] font-bold leading-[34px] tracking-[-0.025em] text-[#050505]"
              >
                {copy.checkout.title}
              </h2>
              <button
                type="button"
                onClick={closeCheckout}
                disabled={processing}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[30px] font-light leading-none text-[#64748b] hover:bg-[#f5f5f5] disabled:opacity-40"
                aria-label={copy.checkout.close}
              >
                ×
              </button>
            </div>

            <div
              className={`mt-[22px] flex flex-col gap-2.5 rounded-[20px] border-[1.5px] p-[22px] ${
                isPack
                  ? "border-[#e0e0e0] bg-[#f9f9f6]"
                  : "border-[#f47a4a] bg-[#fff0e8]"
              }`}
            >
              <p
                className={`m-0 text-[12px] font-bold leading-4 ${
                  isPack ? "text-[#64748b]" : "text-[#f47a4a]"
                }`}
              >
                {isPack ? `${copy.flex.eyebrow} · ${regionLabel}` : `${copy.membership.label} · ${regionLabel}`}
              </p>
              <p className="m-0 text-[28px] font-bold leading-[34px] tracking-[-0.025em]">
                {isPack ? copy.flex.title.replace(/^.*?,\s*/, "") : copy.membership.name}
              </p>
              <div className="flex items-baseline gap-2">
                <p className="m-0 text-[30px] font-bold leading-9">
                  {formatWon(totalAmount)}
                </p>
                <p className="m-0 text-[12px] font-medium text-[#64748b]">
                  {isPack ? copy.flex.oneTime : "/ 30일"}
                </p>
              </div>
              <p className="m-0 text-[12px] leading-[18px] text-[#64748b]">
                {isPack ? copy.checkout.flexSummary : copy.checkout.membershipSummary}
              </p>
            </div>

            <section className="mt-[22px]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 text-[15px] font-bold text-[#050505]">
                  {copy.checkout.referralTitle}
                </h3>
                <span className="text-[12px] font-medium text-[#64748b]">
                  {copy.checkout.optional}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-[18px] text-[#64748b]">
                {copy.checkout.referralHelp}
              </p>
              <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_92px] gap-2 max-[400px]:grid-cols-[minmax(0,1fr)_78px]">
                <input
                  ref={referralInputRef}
                  value={referralCode}
                  placeholder={copy.checkout.referralPlaceholder}
                  onChange={(event) => {
                    setReferralCode(event.target.value);
                    resetReferralApplication();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && referralCode.trim() && !checkingReferral) {
                      event.preventDefault();
                      void applyReferral();
                    }
                  }}
                  className="h-12 min-w-0 rounded-[12px] border-[1.5px] border-[#050505] bg-white px-4 text-[14px] text-[#050505] outline-none placeholder:text-[#94a3b8] focus:shadow-[0_0_0_2px_rgba(244,122,74,0.18)]"
                />
                <button
                  type="button"
                  onClick={() => void applyReferral()}
                  disabled={!referralCode.trim() || checkingReferral}
                  className="h-12 rounded-[12px] bg-[#f47a4a] text-[14px] font-bold text-[#050505] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {checkingReferral ? copy.checkout.checking : copy.checkout.apply}
                </button>
              </div>
              {message ? (
                <StatusMessage error={Boolean(quote && !quote.validReferral)}>
                  {message}
                </StatusMessage>
              ) : (
                <p className="mt-2 flex items-start gap-2 text-[11px] leading-4 text-[#16794f]">
                  <span className="mt-[1px] inline-block h-4 w-4 shrink-0 rounded-full border border-[#16794f]" />
                  <span>{copy.checkout.referralHint}</span>
                </p>
              )}
            </section>

            <div className="my-[22px] h-px w-full bg-[#e0e0e0]" />

            <section>
              <h3 className="m-0 text-[15px] font-bold leading-[22px]">
                {copy.checkout.amountTitle}
              </h3>
              <div className="mt-0.5 flex items-center justify-between py-[5px] text-[14px] leading-5">
                <span className="font-medium text-[#64748b]">
                  {copy.checkout.productAmount}
                </span>
                <span className="font-bold text-[#050505]">
                  {formatWon(selectedProduct.price)}
                </span>
              </div>
              <div className="flex items-center justify-between py-[5px] text-[14px] leading-5">
                <span className="font-medium text-[#64748b]">
                  {copy.checkout.referralDiscount}
                </span>
                <span className={`text-[13px] font-medium ${discount > 0 ? "text-[#16794f]" : "text-[#f47a4a]"}`}>
                  {discount > 0
                    ? `-${formatWon(discount)}`
                    : copy.checkout.appliedAutomatically}
                </span>
              </div>
              <div className="h-px w-full bg-[#e0e0e0]" />
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[15px] font-bold text-[#64748b]">
                  {copy.checkout.dueToday}
                </span>
                <span className="text-[26px] font-bold leading-8 text-[#050505]">
                  {formatWon(totalAmount)}
                </span>
              </div>
            </section>

            <section className="mt-[18px] rounded-[14px] border border-[#dbdbd6] bg-[#fcfbf9] p-[15px]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 text-[14px] font-bold leading-5 text-[#050505]">
                  {copy.refund.title}
                </h3>
                <span className="shrink-0 text-[11px] font-bold text-[#64748b]">
                  {copy.refund.check}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-[11px] leading-[18px] text-[#64748b]">
                <p className="m-0 text-[12px] font-medium text-[#050505]">
                  {isPack ? copy.refund.flexPrimary : copy.refund.membershipPrimary}
                </p>
                <p className="m-0">
                  {isPack ? copy.refund.flexSecondary : copy.refund.membershipSecondary}
                </p>
                <p className="m-0">
                  {isPack ? copy.refund.flexTertiary : copy.refund.membershipTertiary}
                </p>
              </div>
              <a
                href="/policy/refund"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[11px] font-bold text-[#f47a4a] underline underline-offset-2"
              >
                {copy.refund.details}
              </a>
            </section>

            <p className="mt-2 text-center text-[11px] font-medium leading-4 text-[#64748b]">
              {copy.checkout.payplePrefix}
              <a
                href="https://www.payple.kr/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#f47a4a] underline underline-offset-2"
              >
                Payple
              </a>
              {copy.checkout.paypleSuffix}
            </p>

            {error ? <StatusMessage error>{error}</StatusMessage> : null}

            <button
              type="button"
              onClick={() => void handlePayment()}
              disabled={processing || (productId === "membership_30d" && alreadySubscribed)}
              className="mt-2 flex min-h-[54px] w-full items-center justify-center rounded-[27px] bg-[#050505] px-5 text-[15px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            >
              {processing
                ? copy.states.paymentPreparing
                : `${formatWon(totalAmount)} ${copy.checkout.pay}`}
            </button>

            <p className="mt-4 text-[11px] leading-[17px] text-[#64748b]">
              {isPack ? copy.checkout.flexAfterPay : copy.checkout.membershipAfterPay}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#64748b]">
              <span className="text-[8px] text-[#16794f]">●</span>
              <span>{copy.trust.secure}</span>
              <span>·</span>
              <a href="/policy/refund" className="hover:underline">
                {copy.trust.refund}
              </a>
              <span>·</span>
              <a href="/policy/terms" className="hover:underline">
                {copy.trust.terms}
              </a>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
