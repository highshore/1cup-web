"use client";

import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";

import { appLayout } from "../../lib/constants/app_layout";
import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  getAdminGiftsClient,
  listAdminGiftProductsClient,
  lookupAdminGiftProductClient,
  sendAdminGiftClient,
} from "../../lib/features/gifts/services/admin_gift_client";
import type {
  AdminGiftCatalogPage,
  AdminGiftHistoryItem,
  AdminGiftProduct,
  AdminGiftsData,
} from "../../lib/features/gifts/types";

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

const Stack = styled.div`
  display: grid;
  gap: 1.25rem;
`;

const Card = styled.section`
  overflow: hidden;
  border: 3px solid #050505;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.25rem 0;

  @media (max-width: 680px) {
    flex-direction: column;
  }
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

const ProviderInfo = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
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

const Notice = styled.div`
  margin-bottom: 1rem;
  border: 1.5px solid #050505;
  border-left: 5px solid #f47a4a;
  border-radius: 10px;
  background: #fff8f4;
  padding: 0.72rem 0.78rem;
  color: rgba(5, 5, 5, 0.74);
  font-size: 0.74rem;
  font-weight: 650;
  line-height: 1.45;

  strong {
    color: #050505;
    font-weight: 900;
  }
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem 1.25rem;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`;

const FormColumn = styled.div`
  min-width: 0;
`;

const Field = styled.label`
  display: grid;
  gap: 0.4rem;
  margin-top: 0.9rem;
  color: #050505;
  font-size: 0.79rem;
  font-weight: 900;

  &:first-child {
    margin-top: 0;
  }
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

const Textarea = styled.textarea`
  width: 100%;
  min-height: 150px;
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

const MemberPicker = styled.div`
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 10px;
  background: #ffffff;
`;

const SearchWrap = styled.div`
  position: relative;
  border-bottom: 1.5px solid #050505;

  svg {
    position: absolute;
    top: 50%;
    left: 0.7rem;
    width: 1rem;
    height: 1rem;
    transform: translateY(-50%);
    color: rgba(5, 5, 5, 0.52);
  }
`;

const SearchInput = styled(Input)`
  min-height: 40px;
  border: 0;
  border-radius: 0;
  padding-left: 2.1rem;

  &:focus {
    outline: none;
  }
`;

const RecipientList = styled.div`
  max-height: 235px;
  overflow-y: auto;
`;

const RecipientRow = styled.label<{ $selected: boolean; $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 48px;
  border-bottom: 1px solid rgba(5, 5, 5, 0.14);
  background: ${({ $selected }) => ($selected ? "#fff1ea" : "#ffffff")};
  padding: 0.55rem 0.72rem;
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  opacity: ${({ $disabled }) => ($disabled ? 0.52 : 1)};

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: ${({ $disabled }) => ($disabled ? "#ffffff" : "#fff8f4")};
  }

  input {
    width: 1rem;
    height: 1rem;
    accent-color: #f47a4a;
  }
`;

const Avatar = styled.span`
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  font-size: 0.7rem;
  font-weight: 850;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const RecipientText = styled.span`
  display: grid;
  min-width: 0;
  gap: 0.08rem;
`;

const RecipientName = styled.span`
  overflow: hidden;
  color: #050505;
  font-size: 0.81rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RecipientMeta = styled.span`
  overflow: hidden;
  color: rgba(5, 5, 5, 0.55);
  font-size: 0.67rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EmptyRecipients = styled.p`
  margin: 0;
  padding: 1.25rem 0.75rem;
  color: rgba(5, 5, 5, 0.54);
  font-size: 0.8rem;
  text-align: center;
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

const ProductActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
`;

const ManualLookup = styled.details`
  margin-top: 0.7rem;

  summary {
    width: fit-content;
    cursor: pointer;
    color: rgba(5, 5, 5, 0.68);
    font-size: 0.72rem;
    font-weight: 800;
  }
`;

const ManualLookupRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.55rem;
  margin-top: 0.5rem;
`;

const ModalBackdrop = styled.div`
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(5, 5, 5, 0.56);
  padding: 1rem;
`;

const ModalCard = styled.section`
  display: grid;
  width: min(980px, 100%);
  max-height: min(780px, calc(100vh - 2rem));
  overflow: hidden;
  border: 3px solid #050505;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 7px 7px 0 #050505;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 2px solid #050505;
  padding: 1rem 1.1rem;
`;

const ModalTitle = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 1rem;
  font-weight: 950;
`;

const ModalDescription = styled.p`
  margin: 0.25rem 0 0;
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.73rem;
  font-weight: 650;
  line-height: 1.45;
`;

const IconButton = styled.button`
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 2px solid #050505;
  border-radius: 8px;
  background: #ffffff;
  color: #050505;
  cursor: pointer;

  &:hover {
    background: #fff1ea;
  }

  svg {
    width: 1rem;
    height: 1rem;
  }
`;

const CatalogTools = styled.div`
  padding: 0.8rem 1.1rem;
`;

const CatalogSearch = styled(SearchWrap)`
  border: 2px solid #050505;
  border-radius: 10px;
`;

const CatalogSearchInput = styled(SearchInput)`
  border-radius: 8px;
`;

const CatalogList = styled.div`
  min-height: 180px;
  overflow-y: auto;
  padding: 0 1.1rem 1rem;
`;

const CatalogGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;

  @media (max-width: 780px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 500px) {
    grid-template-columns: 1fr;
  }
`;

const CatalogProduct = styled.button<{ $selected: boolean; $disabled: boolean }>`
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 0.65rem;
  width: 100%;
  min-height: 86px;
  align-items: center;
  border: 2px solid #050505;
  border-radius: 11px;
  background: ${({ $selected }) => ($selected ? "#fff1ea" : "#ffffff")};
  padding: 0.58rem;
  color: #050505;
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  font: inherit;
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  text-align: left;

  &:hover:not(:disabled) {
    border-color: #f47a4a;
    background: #fff8f4;
  }
`;

const CatalogImage = styled.div`
  width: 58px;
  height: 58px;
  overflow: hidden;
  border: 1px solid rgba(5, 5, 5, 0.35);
  border-radius: 8px;
  background: #fff8f4;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const CatalogText = styled.span`
  display: grid;
  min-width: 0;
  gap: 0.14rem;
`;

const CatalogName = styled.span`
  overflow: hidden;
  font-size: 0.76rem;
  font-weight: 900;
  line-height: 1.32;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CatalogMeta = styled.span`
  overflow: hidden;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.67rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CatalogFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-top: 1.5px solid rgba(5, 5, 5, 0.18);
  padding: 0.85rem 1.1rem;

  @media (max-width: 560px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const CatalogPaging = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: rgba(5, 5, 5, 0.64);
  font-size: 0.72rem;
  font-weight: 800;
`;

const CatalogActions = styled.div`
  display: flex;
  gap: 0.55rem;

  @media (max-width: 560px) {
    > button {
      flex: 1;
    }
  }
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
  margin-top: 1.1rem;
  border-top: 1.5px solid rgba(5, 5, 5, 0.16);
  padding-top: 1rem;

  @media (max-width: 560px) {
    align-items: stretch;
    flex-direction: column;
  }
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

const HistoryWrap = styled.div`
  overflow-x: auto;
`;

const HistoryTable = styled.div`
  min-width: 880px;
`;

const HistoryRow = styled.div`
  display: grid;
  grid-template-columns: 150px minmax(150px, 1.05fr) minmax(220px, 1.5fr) 105px 125px minmax(170px, 1fr);
  gap: 0.8rem;
  align-items: center;
  border-bottom: 1px solid rgba(5, 5, 5, 0.14);
  padding: 0.72rem 0;

  &:last-child {
    border-bottom: 0;
  }
`;

const HistoryHeaderRow = styled(HistoryRow)`
  border-bottom: 2px solid #050505;
  padding-top: 0;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.03em;
`;

const HistoryPrimary = styled.div`
  min-width: 0;
  color: #050505;
  font-size: 0.78rem;
  font-weight: 850;
  line-height: 1.4;
`;

const HistorySecondary = styled.div`
  margin-top: 0.15rem;
  overflow: hidden;
  color: rgba(5, 5, 5, 0.55);
  font-size: 0.67rem;
  font-weight: 650;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Status = styled.span<{ $status: AdminGiftHistoryItem["status"] }>`
  display: inline-flex;
  width: fit-content;
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
  padding: 0.22rem 0.44rem;
  color: #050505;
  font-size: 0.64rem;
  font-weight: 900;
`;

const ProviderError = styled.div`
  margin-top: 0.15rem;
  color: #991b1b;
  font-size: 0.65rem;
  font-weight: 750;
  line-height: 1.35;
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

function recipientName(value: { displayName: string | null }, fallback: string): string {
  return value.displayName?.trim() || fallback;
}

function initials(value: string): string {
  return value.slice(0, 1).toUpperCase() || "1";
}

export default function AdminGiftsClient() {
  const { t, locale } = useI18n();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const copy = t.admin.gifts;

  const [data, setData] = useState<AdminGiftsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [goodsCode, setGoodsCode] = useState("");
  const [product, setProduct] = useState<AdminGiftProduct | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalog, setCatalog] = useState<AdminGiftCatalogPage | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSelectedCode, setCatalogSelectedCode] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [recipientId, setRecipientId] = useState(CUSTOM_RECIPIENT);
  const [recipientSearch, setRecipientSearch] = useState("");
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

  useEffect(() => {
    if (!isCatalogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsCatalogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isCatalogOpen]);

  const recipients = useMemo(() => data?.recipients ?? [], [data]);
  const selectedRecipient = useMemo(
    () => recipients.find((recipient) => recipient.id === recipientId) ?? null,
    [recipients, recipientId],
  );
  const matchingRecipients = useMemo(() => {
    const query = recipientSearch.trim().toLocaleLowerCase();
    if (!query) return recipients;
    return recipients.filter((recipient) =>
      `${recipient.displayName ?? ""} ${recipient.maskedPhone ?? ""} ${recipient.id}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [recipientSearch, recipients]);
  const matchingCatalogProducts = useMemo(() => {
    const products = catalog?.products ?? [];
    const query = catalogSearch.trim().toLocaleLowerCase();
    if (!query) return products;
    return products.filter((catalogProduct) =>
      `${catalogProduct.goodsName} ${catalogProduct.brandName ?? ""} ${catalogProduct.goodsCode}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [catalog, catalogSearch]);

  const sendDisabledReason = !data?.configured
    ? data?.configurationError || copy.providerNeedsSetup
    : !product
      ? copy.productRequired
      : null;
  const catalogHasNext = Boolean(
    catalog &&
      catalog.products.length === catalog.size &&
      (catalog.total === null || catalog.page * catalog.size < catalog.total),
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

  const loadCatalog = useCallback(async (page: number) => {
    setIsCatalogLoading(true);
    setCatalogError(null);
    try {
      const next = await listAdminGiftProductsClient(page, copy.catalogLoadError);
      setCatalog(next);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : copy.catalogLoadError);
    } finally {
      setIsCatalogLoading(false);
    }
  }, [copy.catalogLoadError]);

  const openCatalog = () => {
    setCatalogSearch("");
    setCatalogSelectedCode(product?.goodsCode ?? null);
    setCatalogError(null);
    setIsCatalogOpen(true);
    void loadCatalog(1);
  };

  const selectCatalogProduct = async () => {
    if (!catalogSelectedCode) return;
    setIsLookingUp(true);
    setCatalogError(null);
    setSendError(null);
    setSendSuccess(null);
    try {
      const next = await lookupAdminGiftProductClient(catalogSelectedCode, copy.lookupError);
      setProduct(next);
      setGoodsCode(next.goodsCode);
      setIsCatalogOpen(false);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : copy.lookupError);
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
      (!custom && (!selectedRecipient || !selectedRecipient.hasPhone))
    ) {
      setSendError(!custom && selectedRecipient && !selectedRecipient.hasPhone
        ? copy.recipientPhoneRequired
        : copy.requiredFields);
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
      {loadError ? (
        <Card>
          <CardBody>
            <InlineStatus $error>{loadError}</InlineStatus>
            <div style={{ marginTop: "0.8rem" }}>
              <SecondaryButton type="button" onClick={() => void load()}>
                <ArrowPathIcon />
                {copy.retry}
              </SecondaryButton>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Stack>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{copy.sendCardTitle}</CardTitle>
                <CardDescription>{copy.sendCardDescription}</CardDescription>
              </div>
              <ProviderInfo>
                <Pill $tone={data?.configured ? "ok" : "error"}>
                  {data?.configured ? copy.providerReady : copy.providerNeedsSetup}
                </Pill>
                <Balance>
                  {copy.balanceLabel}: {formatMoney(data?.balance ?? null)}
                </Balance>
                {data?.balanceError && <Pill $tone="warn">{copy.balanceUnavailable}</Pill>}
                <SecondaryButton type="button" onClick={() => void load()} disabled={isLoading}>
                  <ArrowPathIcon />
                  {copy.refresh}
                </SecondaryButton>
              </ProviderInfo>
            </CardHeader>
            <CardBody>
              <Notice>
                <strong>{copy.liveWarningTitle}</strong> {copy.liveWarning}
              </Notice>

              {!data?.configured && data?.configurationError && (
                <InlineStatus $error>{data.configurationError}</InlineStatus>
              )}

              <FormGrid>
                <FormColumn>
                  <Field>
                    {copy.productCodeLabel}
                    <ProductActions>
                      <SecondaryButton
                        type="button"
                        disabled={!data?.configured || isCatalogLoading}
                        onClick={openCatalog}
                      >
                        <MagnifyingGlassIcon />
                        {copy.lookupProduct}
                      </SecondaryButton>
                    </ProductActions>
                    <ManualLookup>
                      <summary>{copy.manualProductCode}</summary>
                      <ManualLookupRow>
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
                          {isLookingUp ? copy.lookingUp : copy.lookupByCode}
                        </SecondaryButton>
                      </ManualLookupRow>
                    </ManualLookup>
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

                  <Field as="div">
                    {copy.recipientLabel}
                    <MemberPicker>
                      <SearchWrap>
                        <MagnifyingGlassIcon />
                        <SearchInput
                          value={recipientSearch}
                          onChange={(event) => setRecipientSearch(event.target.value)}
                          placeholder={copy.searchRecipients}
                        />
                      </SearchWrap>
                      <RecipientList>
                        <RecipientRow $selected={recipientId === CUSTOM_RECIPIENT}>
                          <input
                            type="radio"
                            name="gift-recipient"
                            checked={recipientId === CUSTOM_RECIPIENT}
                            onChange={() => setRecipientId(CUSTOM_RECIPIENT)}
                          />
                          <Avatar>+</Avatar>
                          <RecipientText>
                            <RecipientName>{copy.customRecipient}</RecipientName>
                          </RecipientText>
                        </RecipientRow>
                        {matchingRecipients.length === 0 ? (
                          <EmptyRecipients>{copy.noRecipients}</EmptyRecipients>
                        ) : (
                          matchingRecipients.map((recipient) => {
                            const name = recipientName(recipient, copy.memberFallback);
                            return (
                              <RecipientRow
                                key={recipient.id}
                                $selected={recipientId === recipient.id}
                                $disabled={!recipient.hasPhone}
                              >
                                <input
                                  type="radio"
                                  name="gift-recipient"
                                  checked={recipientId === recipient.id}
                                  disabled={!recipient.hasPhone}
                                  onChange={() => setRecipientId(recipient.id)}
                                />
                                <Avatar>
                                  {recipient.photoUrl ? <img src={recipient.photoUrl} alt="" /> : initials(name)}
                                </Avatar>
                                <RecipientText>
                                  <RecipientName>{name}</RecipientName>
                                  <RecipientMeta>{recipient.maskedPhone || copy.noPhone}</RecipientMeta>
                                </RecipientText>
                              </RecipientRow>
                            );
                          })
                        )}
                      </RecipientList>
                    </MemberPicker>
                    {recipients.some((recipient) => !recipient.hasPhone) && (
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
                </FormColumn>

                <FormColumn>
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
                </FormColumn>
              </FormGrid>

              <SubmitRow>
                <div>
                  {sendError && <InlineStatus $error>{sendError}</InlineStatus>}
                  {sendSuccess && <InlineStatus>{sendSuccess}</InlineStatus>}
                  {!sendError && !sendSuccess && sendDisabledReason && (
                    <InlineStatus $error>{sendDisabledReason}</InlineStatus>
                  )}
                </div>
                <SendButton
                  type="button"
                  disabled={isSending || Boolean(sendDisabledReason)}
                  onClick={() => void submit()}
                >
                  {isSending ? copy.sending : copy.sendGift}
                </SendButton>
              </SubmitRow>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>{copy.historyTitle}</CardTitle>
                <CardDescription>{copy.historyDescription}</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              {(data?.history ?? []).length === 0 ? (
                <EmptyState>{copy.historyEmpty}</EmptyState>
              ) : (
                <HistoryWrap>
                  <HistoryTable>
                    <HistoryHeaderRow>
                      <div>{copy.historyDate}</div>
                      <div>{copy.historyRecipient}</div>
                      <div>{copy.historyProduct}</div>
                      <div>{copy.historyAmount}</div>
                      <div>{copy.historyStatus}</div>
                      <div>{copy.historyReference}</div>
                    </HistoryHeaderRow>
                    {(data?.history ?? []).map((gift) => (
                      <HistoryRow key={gift.id}>
                        <HistoryPrimary>{formatDate(gift.createdAt)}</HistoryPrimary>
                        <div>
                          <HistoryPrimary>{gift.recipientName || copy.customRecipient}</HistoryPrimary>
                          <HistorySecondary>{gift.recipientPhoneMasked || copy.unavailable}</HistorySecondary>
                        </div>
                        <div>
                          <HistoryPrimary>{gift.goodsName}</HistoryPrimary>
                          <HistorySecondary>{gift.brandName || gift.goodsCode}</HistorySecondary>
                        </div>
                        <HistoryPrimary>{formatMoney(gift.purchasePrice)}</HistoryPrimary>
                        <div>
                          <Status $status={gift.status}>{copy.statusLabels[gift.status]}</Status>
                          {gift.providerMessage && gift.status !== "sent" && (
                            <ProviderError>{gift.providerMessage}</ProviderError>
                          )}
                        </div>
                        <div>
                          <HistoryPrimary>{gift.orderNo || copy.unavailable}</HistoryPrimary>
                          <HistorySecondary>{copy.trId}: {gift.trId}</HistorySecondary>
                        </div>
                      </HistoryRow>
                    ))}
                  </HistoryTable>
                </HistoryWrap>
              )}
            </CardBody>
          </Card>
        </Stack>
      )}

      {isCatalogOpen && (
        <ModalBackdrop role="presentation" onMouseDown={() => setIsCatalogOpen(false)}>
          <ModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="gift-catalog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <ModalHeader>
              <div>
                <ModalTitle id="gift-catalog-title">{copy.catalogTitle}</ModalTitle>
                <ModalDescription>{copy.catalogDescription}</ModalDescription>
              </div>
              <IconButton type="button" onClick={() => setIsCatalogOpen(false)} aria-label={copy.catalogClose}>
                <XMarkIcon />
              </IconButton>
            </ModalHeader>

            <CatalogTools>
              <CatalogSearch>
                <MagnifyingGlassIcon />
                <CatalogSearchInput
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                  placeholder={copy.catalogSearchPlaceholder}
                />
              </CatalogSearch>
            </CatalogTools>

            <CatalogList>
              {isCatalogLoading ? (
                <EmptyState>{copy.catalogLoading}</EmptyState>
              ) : catalogError ? (
                <>
                  <InlineStatus $error>{catalogError}</InlineStatus>
                  <div style={{ marginTop: "0.8rem" }}>
                    <SecondaryButton type="button" onClick={() => void loadCatalog(catalog?.page ?? 1)}>
                      <ArrowPathIcon />
                      {copy.retry}
                    </SecondaryButton>
                  </div>
                </>
              ) : matchingCatalogProducts.length === 0 ? (
                <EmptyState>{catalogSearch.trim() ? copy.catalogNoMatches : copy.catalogEmpty}</EmptyState>
              ) : (
                <CatalogGrid>
                  {matchingCatalogProducts.map((catalogProduct) => {
                    const unavailable = catalogProduct.state !== "SALE";
                    return (
                      <CatalogProduct
                        key={catalogProduct.goodsCode}
                        type="button"
                        $selected={catalogSelectedCode === catalogProduct.goodsCode}
                        $disabled={unavailable}
                        disabled={unavailable}
                        onClick={() => setCatalogSelectedCode(catalogProduct.goodsCode)}
                      >
                        <CatalogImage>
                          {catalogProduct.imageUrl ? <img src={catalogProduct.imageUrl} alt="" /> : null}
                        </CatalogImage>
                        <CatalogText>
                          <CatalogName>{catalogProduct.goodsName}</CatalogName>
                          <CatalogMeta>{catalogProduct.brandName || catalogProduct.goodsCode}</CatalogMeta>
                          <CatalogMeta>
                            {formatMoney(catalogProduct.discountPrice ?? catalogProduct.salePrice)}
                            {unavailable ? ` · ${copy.catalogUnavailable}` : ""}
                          </CatalogMeta>
                        </CatalogText>
                      </CatalogProduct>
                    );
                  })}
                </CatalogGrid>
              )}
            </CatalogList>

            <CatalogFooter>
              <CatalogPaging>
                <SecondaryButton
                  type="button"
                  disabled={isCatalogLoading || !catalog || catalog.page <= 1}
                  onClick={() => catalog && void loadCatalog(catalog.page - 1)}
                >
                  <ArrowLeftIcon />
                  {copy.catalogPrevious}
                </SecondaryButton>
                <span>{copy.catalogPage.replace("{page}", String(catalog?.page ?? 1))}</span>
                <SecondaryButton
                  type="button"
                  disabled={isCatalogLoading || !catalogHasNext}
                  onClick={() => catalog && void loadCatalog(catalog.page + 1)}
                >
                  {copy.catalogNext}
                  <ArrowRightIcon />
                </SecondaryButton>
              </CatalogPaging>
              <CatalogActions>
                <SecondaryButton type="button" onClick={() => setIsCatalogOpen(false)}>
                  {copy.catalogClose}
                </SecondaryButton>
                <SendButton
                  type="button"
                  disabled={!catalogSelectedCode || isLookingUp || isCatalogLoading}
                  onClick={() => void selectCatalogProduct()}
                >
                  {isLookingUp ? copy.lookingUp : copy.catalogChoose}
                </SendButton>
              </CatalogActions>
            </CatalogFooter>
          </ModalCard>
        </ModalBackdrop>
      )}
    </Page>
  );
}
