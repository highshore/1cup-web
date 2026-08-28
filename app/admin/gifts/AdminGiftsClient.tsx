"use client";

import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  StarIcon as StarOutlineIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";

import { appLayout } from "../../lib/constants/app_layout";
import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  getAdminGiftsClient,
  listAdminGiftBrandsClient,
  listAdminGiftBrandProductsClient,
  lookupAdminGiftProductClient,
  sendAdminGiftClient,
  toggleAdminGiftFavoriteClient,
} from "../../lib/features/gifts/services/admin_gift_client";
import type {
  AdminGiftBrand,
  AdminGiftFavorite,
  AdminGiftHistoryItem,
  AdminGiftProduct,
  AdminGiftsData,
} from "../../lib/features/gifts/types";

const MAX_BATCH_RECIPIENTS = 15;
const FEATURED_BRAND_NAMES = [
  "스타벅스",
  "배달의민족",
  "투썸플레이스",
  "커피빈",
  "메가mgc",
  "컴포즈",
  "이디야",
  "빽다방",
  "공차",
  "배스킨라빈스",
  "던킨",
];

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

const FavoriteQuickPicks = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.8rem;
`;

const FavoriteQuickPick = styled.button`
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 0.42rem;
  overflow: hidden;
  border: 1.5px solid #050505;
  border-radius: 9px;
  background: #fffef4;
  padding: 0.4rem;
  color: #050505;
  cursor: pointer;
  font: inherit;
  text-align: left;

  &:hover:not(:disabled) {
    background: #fff1ea;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.6;
  }
`;

const FavoriteQuickImage = styled.div`
  width: 28px;
  height: 28px;
  overflow: hidden;
  border-radius: 6px;
  background: #fff8f4;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  svg {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 0.35rem;
    color: #f47a4a;
  }
`;

const FavoriteQuickText = styled.span`
  overflow: hidden;
  color: #050505;
  font-size: 0.68rem;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(760px, 100%);
  max-height: min(620px, calc(100vh - 2rem));
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
  border-bottom: 1.5px solid rgba(5, 5, 5, 0.18);
  padding: 0.7rem;
`;

const CatalogSearch = styled(SearchWrap)`
  border: 2px solid #050505;
  border-radius: 10px;
`;

const CatalogSearchInput = styled(SearchInput)`
  border-radius: 8px;
`;

const CatalogBody = styled.div`
  display: grid;
  min-height: 0;
  grid-template-columns: 188px minmax(0, 1fr);

  @media (max-width: 620px) {
    grid-template-columns: 145px minmax(0, 1fr);
  }
`;

const BrandPanel = styled.aside`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  border-right: 2px solid #050505;
  background: #fff8f4;
`;

const BrandList = styled.div`
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  padding: 0.35rem;
`;

const BrandButton = styled.button<{ $selected: boolean }>`
  display: block;
  width: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 7px;
  background: ${({ $selected }) => ($selected ? "#f47a4a" : "transparent")};
  padding: 0.55rem 0.58rem;
  color: #050505;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 850;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    background: ${({ $selected }) => ($selected ? "#f47a4a" : "#fff1ea")};
  }
`;

const CatalogItems = styled.div`
  min-height: 0;
  overflow-y: auto;
  padding: 0.85rem;
`;

const CatalogGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const CatalogProduct = styled.div<{ $selected: boolean; $disabled: boolean }>`
  position: relative;
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

  &:hover {
    border-color: ${({ $disabled }) => ($disabled ? "#050505" : "#f47a4a")};
    background: ${({ $disabled, $selected }) =>
      $disabled ? ($selected ? "#fff1ea" : "#ffffff") : "#fff8f4"};
  }
`;

const FavoriteToggle = styled.button<{ $active: boolean }>`
  position: absolute;
  top: 0.38rem;
  right: 0.38rem;
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border: 1px solid #050505;
  border-radius: 999px;
  background: ${({ $active }) => ($active ? "#fef08a" : "#ffffff")};
  color: #050505;
  cursor: pointer;

  &:disabled {
    cursor: wait;
    opacity: 0.55;
  }

  svg {
    width: 0.86rem;
    height: 0.86rem;
  }
`;

const CatalogItemsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  margin-bottom: 0.7rem;
`;

const CatalogBrandName = styled.p`
  margin: 0;
  overflow: hidden;
  color: #050505;
  font-size: 0.78rem;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SortSelect = styled.select`
  min-height: 32px;
  max-width: 168px;
  border: 1.5px solid #050505;
  border-radius: 8px;
  background: #ffffff;
  padding: 0.3rem 0.4rem;
  color: #050505;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 800;
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

const CatalogStatus = styled.div`
  display: flex;
  align-items: center;
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

function brandRank(brandName: string): number {
  const normalized = brandName.replace(/\s/g, "").toLocaleLowerCase();
  const index = FEATURED_BRAND_NAMES.findIndex((name) => normalized.includes(name));
  return index === -1 ? FEATURED_BRAND_NAMES.length : index;
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
  const [brands, setBrands] = useState<AdminGiftBrand[] | null>(null);
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedBrandCode, setSelectedBrandCode] = useState<string | null>(null);
  const [isBrandLoading, setIsBrandLoading] = useState(false);
  const [brandProducts, setBrandProducts] = useState<AdminGiftProduct[] | null>(null);
  const [isBrandProductsLoading, setIsBrandProductsLoading] = useState(false);
  const [catalogSelectedCode, setCatalogSelectedCode] = useState<string | null>(null);
  const [catalogSort, setCatalogSort] = useState<"price-asc" | "price-desc" | "name">("name");
  const [favoriteUpdatingCode, setFavoriteUpdatingCode] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isCustomRecipient, setIsCustomRecipient] = useState(true);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [mmsTitle, setMmsTitle] = useState(copy.defaultMmsTitle);
  const [mmsMessage, setMmsMessage] = useState(copy.defaultMmsMessage);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const brandProductRequest = useRef(0);

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
  const selectedRecipients = useMemo(
    () => recipients.filter((recipient) => selectedRecipientIds.includes(recipient.id)),
    [recipients, selectedRecipientIds],
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
  const matchingBrands = useMemo(() => {
    const query = brandSearch.trim().toLocaleLowerCase();
    const filtered = !query ? brands ?? [] : (brands ?? []).filter((brand) =>
      `${brand.brandName} ${brand.categoryName ?? ""}`.toLocaleLowerCase().includes(query),
    );
    return [...filtered].sort((left, right) =>
      brandRank(left.brandName) - brandRank(right.brandName) ||
      left.brandName.localeCompare(right.brandName, "ko-KR"),
    );
  }, [brandSearch, brands]);
  const selectedBrand = useMemo(
    () => (brands ?? []).find((brand) => brand.brandCode === selectedBrandCode) ?? null,
    [brands, selectedBrandCode],
  );
  const matchingCatalogProducts = useMemo(() => {
    const price = (catalogProduct: AdminGiftProduct) =>
      catalogProduct.discountPrice ?? catalogProduct.salePrice ?? Number.MAX_SAFE_INTEGER;
    return [...(brandProducts ?? [])].sort((left, right) => {
      if (catalogSort === "price-asc") return price(left) - price(right);
      if (catalogSort === "price-desc") return price(right) - price(left);
      return left.goodsName.localeCompare(right.goodsName, "ko-KR");
    });
  }, [brandProducts, catalogSort]);
  const favoriteCodes = useMemo(
    () => new Set((data?.favorites ?? []).map((favorite) => favorite.goodsCode)),
    [data?.favorites],
  );
  const recipientCount = isCustomRecipient
    ? (customPhone.trim() ? 1 : 0)
    : selectedRecipientIds.length;

  const sendDisabledReason = !data?.configured
    ? data?.configurationError || copy.providerNeedsSetup
    : !product
      ? copy.productRequired
      : null;

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

  const loadBrands = useCallback(async () => {
    setIsBrandLoading(true);
    setCatalogError(null);
    try {
      const next = await listAdminGiftBrandsClient(copy.brandLoadError);
      setBrands(next);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : copy.brandLoadError);
    } finally {
      setIsBrandLoading(false);
    }
  }, [copy.brandLoadError]);

  const openCatalog = () => {
    setBrandSearch("");
    setCatalogSelectedCode(product?.goodsCode ?? null);
    setSelectedBrandCode(null);
    setBrands(null);
    setBrandProducts(null);
    setCatalogError(null);
    setIsCatalogOpen(true);
    void loadBrands();
  };

  const selectBrand = (brandCode: string) => {
    const requestId = brandProductRequest.current + 1;
    brandProductRequest.current = requestId;
    setSelectedBrandCode(brandCode);
    setCatalogSelectedCode(null);
    setBrandProducts(null);
    setCatalogError(null);
    setIsBrandProductsLoading(true);
    void listAdminGiftBrandProductsClient(brandCode, copy.catalogLoadError)
      .then((products) => {
        if (brandProductRequest.current === requestId) setBrandProducts(products);
      })
      .catch((error) => {
        if (brandProductRequest.current === requestId) {
          setCatalogError(error instanceof Error ? error.message : copy.catalogLoadError);
        }
      })
      .finally(() => {
        if (brandProductRequest.current === requestId) setIsBrandProductsLoading(false);
      });
  };

  const useProduct = async (goodsCode: string, closeCatalog = false) => {
    setIsLookingUp(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const next = await lookupAdminGiftProductClient(goodsCode, copy.lookupError);
      setProduct(next);
      setGoodsCode(next.goodsCode);
      if (closeCatalog) setIsCatalogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.lookupError;
      if (closeCatalog) setCatalogError(message);
      else setSendError(message);
    } finally {
      setIsLookingUp(false);
    }
  };

  const toggleFavorite = async (catalogProduct: AdminGiftProduct) => {
    setFavoriteUpdatingCode(catalogProduct.goodsCode);
    setCatalogError(null);
    try {
      const result = await toggleAdminGiftFavoriteClient(catalogProduct.goodsCode, copy.favoriteError);
      setData((current) => {
        if (!current) return current;
        if (!result.isFavorite) {
          return {
            ...current,
            favorites: current.favorites.filter((favorite) => favorite.goodsCode !== catalogProduct.goodsCode),
          };
        }
        const favorite: AdminGiftFavorite = {
          ...result.product,
          createdAt: new Date().toISOString(),
        };
        return {
          ...current,
          favorites: [
            ...current.favorites.filter((item) => item.goodsCode !== favorite.goodsCode),
            favorite,
          ],
        };
      });
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : copy.favoriteError);
    } finally {
      setFavoriteUpdatingCode(null);
    }
  };

  const selectCatalogProduct = async () => {
    if (!catalogSelectedCode) return;
    await useProduct(catalogSelectedCode, true);
  };

  const toggleRecipient = (recipientId: string) => {
    setIsCustomRecipient(false);
    setSelectedRecipientIds((current) =>
      current.includes(recipientId)
        ? current.filter((id) => id !== recipientId)
        : [...current, recipientId],
    );
  };

  const submit = async () => {
    setSendError(null);
    setSendSuccess(null);
    const custom = isCustomRecipient;
    const recipientDisplay = custom
      ? customName.trim() || lastFour(customPhone)
      : copy.recipientSelectedCount.replace("{count}", String(selectedRecipients.length));

    if (
      !product ||
      !mmsTitle.trim() ||
      !mmsMessage.trim() ||
      (custom && !customPhone.trim()) ||
      (!custom &&
        (selectedRecipients.length === 0 ||
          selectedRecipients.length !== selectedRecipientIds.length ||
          selectedRecipients.some((recipient) => !recipient.hasPhone)))
    ) {
      setSendError(!custom ? copy.recipientPhoneRequired : copy.requiredFields);
      return;
    }
    if ([...mmsTitle.trim()].length > 10) {
      setSendError(copy.titleLengthError);
      return;
    }

    const price = formatMoney(product.discountPrice ?? product.salePrice);
    const unitPrice = product.discountPrice ?? product.salePrice;
    const total = unitPrice === null ? copy.unavailable : formatMoney(unitPrice * recipientCount);
    const confirmed = window.confirm(
      copy.sendConfirm
        .replace("{product}", product.goodsName)
        .replace("{recipient}", recipientDisplay)
        .replace("{price}", price)
        .replace("{total}", total),
    );
    if (!confirmed) return;

    setIsSending(true);
    try {
      const result = await sendAdminGiftClient(
        {
          memberIds: custom ? [] : selectedRecipientIds,
          recipientName: custom ? customName.trim() || null : null,
          phoneNumber: custom ? customPhone : null,
          goodsCode: product.goodsCode,
          mmsTitle: mmsTitle.trim(),
          mmsMessage: mmsMessage.trim(),
        },
        copy.sendError,
      );
      if (result.sentCount > 0) {
        setSendSuccess(
          copy.sent
            .replace("{product}", product.goodsName)
            .replace("{count}", String(result.sentCount)),
        );
      }
      if (result.failureMessage) {
        setSendError(
          copy.partialSend
            .replace("{sent}", String(result.sentCount))
            .replace("{total}", String(result.recipientCount))
            .replace("{remaining}", String(result.recipientCount - result.sentCount))
            .replace("{message}", result.failureMessage),
        );
      }
      if (custom && result.sentCount > 0) {
        setCustomName("");
        setCustomPhone("");
      } else if (!custom && result.sentMemberIds.length > 0) {
        setSelectedRecipientIds((current) =>
          current.filter((memberId) => !result.sentMemberIds.includes(memberId)),
        );
      }
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
                        disabled={!data?.configured || isBrandLoading}
                        onClick={openCatalog}
                      >
                        <MagnifyingGlassIcon />
                        {copy.lookupProduct}
                      </SecondaryButton>
                    </ProductActions>
                    {(data?.favorites ?? []).length > 0 && (
                      <>
                        <FieldHint>{copy.quickPicks}</FieldHint>
                        <FavoriteQuickPicks>
                          {(data?.favorites ?? []).map((favorite) => (
                            <FavoriteQuickPick
                              key={favorite.goodsCode}
                              type="button"
                              disabled={isLookingUp}
                              onClick={() => void useProduct(favorite.goodsCode)}
                              title={favorite.goodsName}
                            >
                              <FavoriteQuickImage>
                                {favorite.imageUrl ? <img src={favorite.imageUrl} alt="" /> : <StarSolidIcon />}
                              </FavoriteQuickImage>
                              <FavoriteQuickText>{favorite.goodsName}</FavoriteQuickText>
                            </FavoriteQuickPick>
                          ))}
                        </FavoriteQuickPicks>
                      </>
                    )}
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
                        <RecipientRow $selected={isCustomRecipient}>
                          <input
                            type="radio"
                            name="gift-recipient"
                            checked={isCustomRecipient}
                            onChange={() => {
                              setIsCustomRecipient(true);
                              setSelectedRecipientIds([]);
                            }}
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
                            const isSelected = selectedRecipientIds.includes(recipient.id);
                            const selectionLimitReached =
                              !isSelected && selectedRecipientIds.length >= MAX_BATCH_RECIPIENTS;
                            const disabled = !recipient.hasPhone || selectionLimitReached;
                            return (
                              <RecipientRow
                                key={recipient.id}
                                $selected={isSelected}
                                $disabled={disabled}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={disabled}
                                  onChange={() => toggleRecipient(recipient.id)}
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
                    <FieldHint>
                      {copy.recipientSelectedCount.replace("{count}", String(recipientCount))}
                      {" · "}
                      {copy.recipientLimit.replace("{count}", String(MAX_BATCH_RECIPIENTS))}
                    </FieldHint>
                  </Field>

                  {isCustomRecipient && (
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
                  {isSending
                    ? copy.sending
                    : copy.sendGift.replace("{count}", String(recipientCount))}
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

            <CatalogBody>
              <BrandPanel>
                <CatalogTools>
                  <CatalogSearch>
                    <MagnifyingGlassIcon />
                    <CatalogSearchInput
                      value={brandSearch}
                      onChange={(event) => setBrandSearch(event.target.value)}
                      placeholder={copy.brandSearchPlaceholder}
                    />
                  </CatalogSearch>
                </CatalogTools>
                <BrandList>
                  {isBrandLoading ? (
                    <EmptyState>{copy.brandLoading}</EmptyState>
                  ) : matchingBrands.length === 0 ? (
                    <EmptyState>{copy.brandEmpty}</EmptyState>
                  ) : (
                    matchingBrands.map((brand) => (
                      <BrandButton
                        key={brand.brandCode}
                        type="button"
                        $selected={brand.brandCode === selectedBrandCode}
                        onClick={() => selectBrand(brand.brandCode)}
                      >
                        {brand.brandName}
                      </BrandButton>
                    ))
                  )}
                </BrandList>
              </BrandPanel>

              <CatalogItems>
                {selectedBrand && (
                  <CatalogItemsHeader>
                    <CatalogBrandName>{selectedBrand.brandName}</CatalogBrandName>
                    <SortSelect
                      value={catalogSort}
                      onChange={(event) =>
                        setCatalogSort(event.target.value as "price-asc" | "price-desc" | "name")
                      }
                      aria-label={copy.sortProducts}
                    >
                      <option value="name">{copy.sortName}</option>
                      <option value="price-asc">{copy.sortPriceAsc}</option>
                      <option value="price-desc">{copy.sortPriceDesc}</option>
                    </SortSelect>
                  </CatalogItemsHeader>
                )}
                {!selectedBrand ? (
                  <EmptyState>{copy.catalogChooseBrand}</EmptyState>
                ) : isBrandProductsLoading && !brandProducts ? (
                  <EmptyState>{copy.catalogLoading}</EmptyState>
                ) : catalogError ? (
                  <>
                    <InlineStatus $error>{catalogError}</InlineStatus>
                    <div style={{ marginTop: "0.8rem" }}>
                      <SecondaryButton
                        type="button"
                        onClick={() => selectedBrandCode ? selectBrand(selectedBrandCode) : void loadBrands()}
                      >
                        <ArrowPathIcon />
                        {copy.retry}
                      </SecondaryButton>
                    </div>
                  </>
                ) : matchingCatalogProducts.length === 0 ? (
                  <EmptyState>{copy.catalogEmpty}</EmptyState>
                ) : (
                  <CatalogGrid>
                    {matchingCatalogProducts.map((catalogProduct) => {
                      const unavailable = catalogProduct.state !== "SALE";
                      return (
                        <CatalogProduct
                          key={catalogProduct.goodsCode}
                          role="button"
                          tabIndex={unavailable ? -1 : 0}
                          aria-disabled={unavailable}
                          $selected={catalogSelectedCode === catalogProduct.goodsCode}
                          $disabled={unavailable}
                          onClick={() => {
                            if (!unavailable) setCatalogSelectedCode(catalogProduct.goodsCode);
                          }}
                          onKeyDown={(event) => {
                            if (!unavailable && (event.key === "Enter" || event.key === " ")) {
                              event.preventDefault();
                              setCatalogSelectedCode(catalogProduct.goodsCode);
                            }
                          }}
                        >
                          <FavoriteToggle
                            type="button"
                            $active={favoriteCodes.has(catalogProduct.goodsCode)}
                            disabled={favoriteUpdatingCode === catalogProduct.goodsCode}
                            aria-label={
                              favoriteCodes.has(catalogProduct.goodsCode)
                                ? copy.removeFavorite
                                : copy.addFavorite
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleFavorite(catalogProduct);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            {favoriteCodes.has(catalogProduct.goodsCode) ? <StarSolidIcon /> : <StarOutlineIcon />}
                          </FavoriteToggle>
                          <CatalogImage>
                            {catalogProduct.imageUrl ? <img src={catalogProduct.imageUrl} alt="" /> : null}
                          </CatalogImage>
                          <CatalogText>
                            <CatalogName>{catalogProduct.goodsName}</CatalogName>
                            <CatalogMeta>{catalogProduct.goodsCode}</CatalogMeta>
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
              </CatalogItems>
            </CatalogBody>

            <CatalogFooter>
              <CatalogStatus>
                {!selectedBrand
                  ? copy.catalogChooseBrand
                  : isBrandProductsLoading
                    ? copy.catalogLoading
                    : copy.catalogAvailableCount.replace("{count}", String(matchingCatalogProducts.length))}
              </CatalogStatus>
              <CatalogActions>
                <SecondaryButton type="button" onClick={() => setIsCatalogOpen(false)}>
                  {copy.catalogClose}
                </SecondaryButton>
                <SendButton
                  type="button"
                  disabled={!catalogSelectedCode || isLookingUp || isBrandProductsLoading}
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
