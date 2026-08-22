"use client";

import {
  ArrowPathIcon,
  GiftIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";

import { appLayout } from "../../lib/constants/app_layout";
import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  getAdminGiftsClient,
  lookupAdminGiftProductClient,
  sendAdminGiftClient,
} from "../../lib/features/gifts/services/admin_gift_client";
import type {
  AdminGiftHistoryItem,
  AdminGiftProduct,
  AdminGiftsData,
} from "../../lib/features/gifts/types";

const DEFAULT_GOODS_CODE = "G00003320983";
const CUSTOM_RECIPIENT = "__custom__";

const Page = styled.main`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  box-sizing: border-box;
  margin: 0 auto;
  padding: 0 ${appLayout.pageGutterDesktop} 2.5rem;

  @media (max-width: 640px) {
    padding-right: ${appLayout.pageGutterMobile};
    padding-left: ${appLayout.pageGutterMobile};
  }
`;

const Heading = styled.header`
  margin: 0 0 1.35rem;
`;

const Eyebrow = styled.p`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.48rem;
  color: #050505;
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.075em;
  text-transform: uppercase;

  svg {
    width: 1rem;
    height: 1rem;
  }
`;

const Title = styled.h1`
  margin: 0;
  color: #050505;
  font-size: clamp(1.75rem, 4vw, 2.2rem);
  font-weight: 900;
  letter-spacing: -0.025em;
`;

const Description = styled.p`
  max-width: 680px;
  margin: 0.62rem 0 0;
  color: rgba(5, 5, 5, 0.64);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.55;
`;

const ProviderStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #fff8f4;
  padding: 0.72rem 0.8rem;
`;

const ProviderInfo = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
`;

const Pill = styled.span<{ $tone?: "ok" | "warn" | "error" }>`
  display: inline-flex;
  align-items: center;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: ${({ $tone }) =>
    $tone === "ok" ? "#dcfce7" : $tone === "error" ? "#fee2e2" : "#fff3cd"};
  padding: 0.28rem 0.55rem;
  color: #050505;
  font-size: 0.72rem;
  font-weight: 900;
`;

const Balance = styled.span`
  color: #050505;
  font-size: 0.79rem;
  font-weight: 850;
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
  align-items: start;
  gap: 1.15rem;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.section`
  overflow: hidden;
  border: 3px solid #050505;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
`;

const CardHeader = styled.div`
  padding: 1.25rem 1.25rem 0;
`;

const CardTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 1rem;
  font-weight: 900;
`;

const CardDescription = styled.p`
  margin: 0.38rem 0 0;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.5;
`;

const CardBody = styled.div`
  padding: 1.05rem 1.25rem 1.25rem;
`;

const Warning = styled.div`
  margin-bottom: 1rem;
  border: 1.5px solid #050505;
  border-left: 5px solid #f47a4a;
  border-radius: 10px;
  background: #fff8f4;
  padding: 0.75rem;
  color: #050505;
  font-size: 0.75rem;
  font-weight: 650;
  line-height: 1.45;

  strong {
    display: block;
    margin-bottom: 0.2rem;
    font-weight: 900;
  }
`;

const Field = styled.label`
  display: grid;
  gap: 0.4rem;
  margin-top: 0.9rem;
  color: #050505;
  font-size: 0.79rem;
  font-weight: 900;
`;

const Input = styled.input`
  width: 100%;
  min-height: 42px;
  box-sizing: border-box;
  border: 2px solid #050505;
  border-radius: 10px;
  background: #ffffff;
  padding: 0.6rem 0.7rem;
  color: #050505;
  font: inherit;
  font-size: 0.86rem;

  &:focus {
    outline: 3px solid #f47a4a;
  }
`;

const Select = styled.select`
  width: 100%;
  min-height: 42px;
  box-sizing: border-box;
  border: 2px solid #050505;
  border-radius: 10px;
  background: #ffffff;
  padding: 0.6rem 0.7rem;
  color: #050505;
  font: inherit;
  font-size: 0.86rem;

  &:focus {
    outline: 3px solid #f47a4a;
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 112px;
  box-sizing: border-box;
  resize: vertical;
  border: 2px solid #050505;
  border-radius: 10px;
  background: #ffffff;
  padding: 0.65rem 0.7rem;
  color: #050505;
  font: inherit;
  font-size: 0.86rem;
  line-height: 1.5;

  &:focus {
    outline: 3px solid #f47a4a;
  }
`;

const FieldHint = styled.p`
  margin: -0.05rem 0 0;
  color: rgba(5, 5, 5, 0.56);
  font-size: 0.7rem;
  font-weight: 600;
`;

const LookupRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.55rem;
`;

const SecondaryButton = styled.button`
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 2px solid #050505;
  border-radius: 10px;
  background: #ffffff;
  padding: 0.55rem 0.68rem;
  box-shadow: 2px 2px 0 #050505;
  color: #050505;
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 900;

  &:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    background: #fff1ea;
    box-shadow: 3px 3px 0 #050505;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  svg {
    width: 0.95rem;
    height: 0.95rem;
  }
`;

const ProductCard = styled.div`
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 0.8rem;
  margin-top: 0.8rem;
  border: 1.5px solid #050505;
  border-radius: 12px;
  background: #fff8f4;
  padding: 0.72rem;
`;

const ProductImage = styled.div`
  width: 74px;
  height: 74px;
  overflow: hidden;
  border: 1.5px solid #050505;
  border-radius: 9px;
  background: #ffffff;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const ProductName = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 0.85rem;
  font-weight: 900;
  line-height: 1.35;
`;

const ProductMeta = styled.p`
  margin: 0.25rem 0 0;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.7rem;
  font-weight: 650;
  line-height: 1.4;
`;

const TwoColumns = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;

  @media (max-width: 540px) {
    grid-template-columns: 1fr;
  }
`;

const SubmitRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1rem;
`;

const SendButton = styled.button`
  min-height: 42px;
  border: 2px solid #050505;
  border-radius: 10px;
  background: #f47a4a;
  padding: 0.65rem 0.9rem;
  box-shadow: 3px 3px 0 #050505;
  color: #050505;
  cursor: pointer;
  font: inherit;
  font-size: 0.81rem;
  font-weight: 900;

  &:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    background: #f88d63;
    box-shadow: 4px 4px 0 #050505;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    box-shadow: none;
  }
`;

const InlineStatus = styled.p<{ $error?: boolean }>`
  margin: 0;
  color: ${({ $error }) => ($error ? "#991b1b" : "#0f6b32")};
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1.4;
`;

const HistoryList = styled.div`
  display: grid;
  gap: 0.68rem;
`;

const HistoryItem = styled.article`
  border: 1.5px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.78rem;
`;

const HistoryHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
`;

const HistoryTitle = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 0.82rem;
  font-weight: 900;
  line-height: 1.35;
`;

const Status = styled.span<{ $status: AdminGiftHistoryItem["status"] }>`
  flex: 0 0 auto;
  border: 1px solid #050505;
  border-radius: 999px;
  background: ${({ $status }) =>
    $status === "sent"
      ? "#dcfce7"
      : $status === "pending"
        ? "#fff3cd"
        : $status === "cancelled_after_timeout"
          ? "#e0f2fe"
          : "#fee2e2"};
  padding: 0.2rem 0.42rem;
  color: #050505;
  font-size: 0.62rem;
  font-weight: 900;
`;

const HistoryMeta = styled.p`
  margin: 0.35rem 0 0;
  color: rgba(5, 5, 5, 0.56);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.45;
`;

const HistoryMessage = styled.p`
  display: -webkit-box;
  margin: 0.42rem 0 0;
  overflow: hidden;
  color: rgba(5, 5, 5, 0.67);
  font-size: 0.72rem;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
`;

const ProviderError = styled.p`
  margin: 0.42rem 0 0;
  color: #991b1b;
  font-size: 0.67rem;
  font-weight: 750;
  line-height: 1.4;
`;

const EmptyState = styled.p`
  margin: 0;
  padding: 1.4rem 0.5rem;
  color: rgba(5, 5, 5, 0.54);
  font-size: 0.78rem;
  font-weight: 700;
  text-align: center;
`;

const LoadingState = styled.div`
  display: grid;
  min-height: 260px;
  place-items: center;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.88rem;
  font-weight: 800;
`;

function lastFour(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `***-****-${digits.slice(-4)}` : value;
}

export default function AdminGiftsClient() {
  const { t, locale } = useI18n();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const copy = t.admin.gifts;

  const [data, setData] = useState<AdminGiftsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [goodsCode, setGoodsCode] = useState(DEFAULT_GOODS_CODE);
  const [product, setProduct] = useState<AdminGiftProduct | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [recipientId, setRecipientId] = useState(CUSTOM_RECIPIENT);
  const [customName, setCustomName] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [mmsTitle, setMmsTitle] = useState(copy.defaultMmsTitle);
  const [mmsMessage, setMmsMessage] = useState(copy.defaultMmsMessage);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const next = await getAdminGiftsClient(copy.loadError);
      setData(next);
      setProduct((current) => current ?? next.defaultProduct);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : copy.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    if (accountStatus !== "admin") {
      router.replace("/");
      return;
    }
    void load();
  }, [accountStatus, authLoading, currentUser, load, router]);

  useEffect(() => {
    setMmsTitle((current) => current || copy.defaultMmsTitle);
    setMmsMessage((current) => current || copy.defaultMmsMessage);
  }, [copy.defaultMmsMessage, copy.defaultMmsTitle]);

  const availableRecipients = useMemo(
    () => (data?.recipients ?? []).filter((recipient) => recipient.hasPhone),
    [data],
  );
  const selectedRecipient = useMemo(
    () => availableRecipients.find((recipient) => recipient.id === recipientId) ?? null,
    [availableRecipients, recipientId],
  );

  const formatMoney = (value: number | null) =>
    value === null
      ? copy.unavailable
      : new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
          style: "currency",
          currency: "KRW",
          maximumFractionDigits: 0,
        }).format(value);

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  const lookupProduct = async () => {
    setIsLookingUp(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const next = await lookupAdminGiftProductClient(goodsCode, copy.lookupError);
      setProduct(next);
      setGoodsCode(next.goodsCode);
    } catch (error) {
      setProduct(null);
      setSendError(error instanceof Error ? error.message : copy.lookupError);
    } finally {
      setIsLookingUp(false);
    }
  };

  const submit = async () => {
    setSendError(null);
    setSendSuccess(null);
    const custom = recipientId === CUSTOM_RECIPIENT;
    const recipientDisplay = custom
      ? customName.trim() || lastFour(customPhone)
      : selectedRecipient?.displayName || selectedRecipient?.maskedPhone || copy.memberFallback;

    if (
      !product ||
      !mmsTitle.trim() ||
      !mmsMessage.trim() ||
      (custom && !customPhone.trim()) ||
      (!custom && !selectedRecipient)
    ) {
      setSendError(copy.requiredFields);
      return;
    }
    if ([...mmsTitle.trim()].length > 10) {
      setSendError(copy.titleLengthError);
      return;
    }

    const price = formatMoney(product.discountPrice ?? product.salePrice);
    const confirmed = window.confirm(
      copy.sendConfirm
        .replace("{product}", product.goodsName)
        .replace("{recipient}", recipientDisplay)
        .replace("{price}", price),
    );
    if (!confirmed) return;

    setIsSending(true);
    try {
      const result = await sendAdminGiftClient(
        {
          memberId: custom ? null : selectedRecipient?.id ?? null,
          recipientName: custom ? customName.trim() || null : selectedRecipient?.displayName ?? null,
          phoneNumber: custom ? customPhone : null,
          goodsCode: product.goodsCode,
          mmsTitle: mmsTitle.trim(),
          mmsMessage: mmsMessage.trim(),
        },
        copy.sendError,
      );
      setSendSuccess(copy.sent.replace("{product}", result.gift.goodsName));
      await load();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : copy.sendError);
      await load();
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading || (!data && isLoading && !loadError)) {
    return <LoadingState>{copy.loading}</LoadingState>;
  }
  if (!currentUser || accountStatus !== "admin") {
    return <LoadingState>{copy.loading}</LoadingState>;
  }

  return (
    <Page>
      <Heading>
        <Eyebrow>
          <GiftIcon />
          {copy.eyebrow}
        </Eyebrow>
        <Title>{copy.pageTitle}</Title>
        <Description>{copy.pageDescription}</Description>
        {data && (
          <ProviderStrip>
            <ProviderInfo>
              <Pill $tone={data.configured ? "ok" : "error"}>
                {data.configured ? copy.providerReady : copy.providerNeedsSetup}
              </Pill>
              <Balance>
                {copy.balanceLabel}: {formatMoney(data.balance)}
              </Balance>
              {data.balanceError && <Pill $tone="warn">{copy.balanceUnavailable}</Pill>}
            </ProviderInfo>
            <SecondaryButton type="button" onClick={() => void load()} disabled={isLoading}>
              <ArrowPathIcon />
              {copy.refresh}
            </SecondaryButton>
          </ProviderStrip>
        )}
      </Heading>

      {loadError ? (
        <Card>
          <CardBody>
            <InlineStatus $error>{loadError}</InlineStatus>
            <SecondaryButton type="button" onClick={() => void load()}>{copy.retry}</SecondaryButton>
          </CardBody>
        </Card>
      ) : (
        <Layout>
          <Card>
            <CardHeader>
              <CardTitle>{copy.sendCardTitle}</CardTitle>
              <CardDescription>{copy.sendCardDescription}</CardDescription>
            </CardHeader>
            <CardBody>
              <Warning>
                <strong>{copy.liveWarningTitle}</strong>
                {copy.liveWarning}
              </Warning>

              {!data?.configured && data?.configurationError && (
                <InlineStatus $error>{data.configurationError}</InlineStatus>
              )}

              <Field>
                {copy.productCodeLabel}
                <LookupRow>
                  <Input
                    value={goodsCode}
                    onChange={(event) => setGoodsCode(event.target.value.toUpperCase())}
                    placeholder={copy.productCodePlaceholder}
                    autoCapitalize="characters"
                  />
                  <SecondaryButton
                    type="button"
                    disabled={!data?.configured || isLookingUp || !goodsCode.trim()}
                    onClick={() => void lookupProduct()}
                  >
                    <MagnifyingGlassIcon />
                    {isLookingUp ? copy.lookingUp : copy.lookupProduct}
                  </SecondaryButton>
                </LookupRow>
              </Field>

              {product && (
                <ProductCard>
                  <ProductImage>
                    {product.imageUrl ? <img src={product.imageUrl} alt="" /> : null}
                  </ProductImage>
                  <div>
                    <ProductName>{product.goodsName}</ProductName>
                    <ProductMeta>{product.brandName || product.goodsCode}</ProductMeta>
                    <ProductMeta>
                      {copy.purchasePrice}: {formatMoney(product.discountPrice ?? product.salePrice)}
                      {product.salePrice !== null && product.discountPrice !== product.salePrice
                        ? ` · ${copy.listPrice}: ${formatMoney(product.salePrice)}`
                        : ""}
                    </ProductMeta>
                    <ProductMeta>
                      {copy.productState}: {product.state || copy.unavailable}
                      {product.limitDay !== null
                        ? ` · ${copy.validity}: ${product.limitDay}${copy.days}`
                        : ""}
                    </ProductMeta>
                  </div>
                </ProductCard>
              )}

              <Field>
                {copy.recipientLabel}
                <Select value={recipientId} onChange={(event) => setRecipientId(event.target.value)}>
                  <option value={CUSTOM_RECIPIENT}>{copy.customRecipient}</option>
                  {availableRecipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.displayName || copy.memberFallback} · {recipient.maskedPhone}
                    </option>
                  ))}
                </Select>
                {(data?.recipients ?? []).some((recipient) => !recipient.hasPhone) && (
                  <FieldHint>{copy.noPhoneHint}</FieldHint>
                )}
              </Field>

              {recipientId === CUSTOM_RECIPIENT && (
                <TwoColumns>
                  <Field>
                    {copy.recipientNameLabel}
                    <Input
                      value={customName}
                      maxLength={120}
                      onChange={(event) => setCustomName(event.target.value)}
                      placeholder={copy.recipientNamePlaceholder}
                    />
                  </Field>
                  <Field>
                    {copy.phoneLabel}
                    <Input
                      value={customPhone}
                      inputMode="tel"
                      onChange={(event) => setCustomPhone(event.target.value)}
                      placeholder={copy.phonePlaceholder}
                    />
                  </Field>
                </TwoColumns>
              )}

              <Field>
                {copy.mmsTitleLabel}
                <Input
                  value={mmsTitle}
                  maxLength={10}
                  onChange={(event) => setMmsTitle(event.target.value)}
                />
                <FieldHint>{copy.mmsTitleHint.replace("{count}", String([...mmsTitle].length))}</FieldHint>
              </Field>

              <Field>
                {copy.messageLabel}
                <Textarea
                  value={mmsMessage}
                  maxLength={4000}
                  onChange={(event) => setMmsMessage(event.target.value)}
                />
                <FieldHint>{copy.messageHint}</FieldHint>
              </Field>

              <SubmitRow>
                <div>
                  {sendError && <InlineStatus $error>{sendError}</InlineStatus>}
                  {sendSuccess && <InlineStatus>{sendSuccess}</InlineStatus>}
                  {data?.balance === 0 && <InlineStatus $error>{copy.noBalance}</InlineStatus>}
                </div>
                <SendButton
                  type="button"
                  disabled={isSending || !data?.configured || data?.balance === 0 || !product}
                  onClick={() => void submit()}
                >
                  {isSending ? copy.sending : copy.sendGift}
                </SendButton>
              </SubmitRow>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.historyTitle}</CardTitle>
              <CardDescription>{copy.historyDescription}</CardDescription>
            </CardHeader>
            <CardBody>
              {(data?.history ?? []).length === 0 ? (
                <EmptyState>{copy.historyEmpty}</EmptyState>
              ) : (
                <HistoryList>
                  {(data?.history ?? []).map((gift) => (
                    <HistoryItem key={gift.id}>
                      <HistoryHeader>
                        <HistoryTitle>{gift.goodsName}</HistoryTitle>
                        <Status $status={gift.status}>{copy.statusLabels[gift.status]}</Status>
                      </HistoryHeader>
                      <HistoryMeta>
                        {gift.recipientName || copy.customRecipient} · {gift.recipientPhoneMasked || copy.unavailable}
                      </HistoryMeta>
                      <HistoryMeta>
                        {formatMoney(gift.purchasePrice)} · {formatDate(gift.createdAt)}
                      </HistoryMeta>
                      <HistoryMessage>{gift.mmsMessage}</HistoryMessage>
                      <HistoryMeta>{copy.trId}: {gift.trId}</HistoryMeta>
                      {gift.orderNo && <HistoryMeta>{copy.orderNo}: {gift.orderNo}</HistoryMeta>}
                      {gift.providerMessage && gift.status !== "sent" && (
                        <ProviderError>
                          {copy.providerMessage}: {gift.providerMessage}
                        </ProviderError>
                      )}
                    </HistoryItem>
                  ))}
                </HistoryList>
              )}
            </CardBody>
          </Card>
        </Layout>
      )}
    </Page>
  );
}
