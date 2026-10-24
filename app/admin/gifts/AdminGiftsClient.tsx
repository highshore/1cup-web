"use client";

import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  StarIcon as StarOutlineIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { useAuth } from "../../lib/contexts/auth_context";
import type { getDictionary } from "../../lib/i18n";
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
  AdminGiftRecipient,
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

type DivProps = HTMLAttributes<HTMLDivElement>;
type SectionProps = HTMLAttributes<HTMLElement>;
type SpanProps = HTMLAttributes<HTMLSpanElement>;
type ParagraphProps = HTMLAttributes<HTMLParagraphElement>;
type HeadingProps = HTMLAttributes<HTMLHeadingElement>;
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
type InputProps = InputHTMLAttributes<HTMLInputElement>;
type GiftsCopy = ReturnType<typeof getDictionary>["admin"]["gifts"];
type CatalogSort = "price-asc" | "price-desc" | "name";

function Page({ className = "", ...rest }: SectionProps) {
  return (
    <main
      {...rest}
      className={`w-full max-w-page box-border mx-auto px-gutter pb-10 max-[640px]:px-gutter-mobile ${className}`}
    />
  );
}

const MONEY_OPTIONS: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
};
const MONEY_FORMAT = {
  ko: new Intl.NumberFormat("ko-KR", MONEY_OPTIONS),
  en: new Intl.NumberFormat("en-US", MONEY_OPTIONS),
};
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};
const DATE_TIME_FORMAT = {
  ko: new Intl.DateTimeFormat("ko-KR", DATE_TIME_OPTIONS),
  en: new Intl.DateTimeFormat("en-US", DATE_TIME_OPTIONS),
};

function Stack({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`grid gap-5 ${className}`} />;
}

function Card({ className = "", ...rest }: SectionProps) {
  return (
    <section
      {...rest}
      className={`overflow-hidden border-[3px] border-[#050505] rounded-[16px] bg-white shadow-[6px_6px_0_rgba(5,5,5,0.9)] ${className}`}
    />
  );
}

function CardHeader({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex items-start justify-between gap-4 px-5 pt-5 max-[680px]:flex-col ${className}`}
    />
  );
}

function CardTitle({ className = "", ...rest }: HeadingProps) {
  return <h2 {...rest} className={`m-0 text-[#050505] text-[1rem] font-black ${className}`} />;
}

function CardDescription({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`mx-0 mt-[0.38rem] mb-0 text-[rgba(5,5,5,0.6)] text-[0.78rem] font-semibold leading-[1.5] ${className}`}
    />
  );
}

function CardBody({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`px-5 pt-[1.05rem] pb-5 ${className}`} />;
}

function ProviderInfo({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`flex flex-wrap items-center justify-end gap-2 ${className}`} />;
}

function Pill({
  $tone,
  className = "",
  ...rest
}: { $tone?: "ok" | "warn" | "error" } & SpanProps) {
  return (
    <span
      {...rest}
      className={`inline-flex items-center border-[1.5px] border-[#050505] rounded-full px-[0.55rem] py-[0.28rem] text-[#050505] text-[0.72rem] font-black ${
        $tone === "ok" ? "bg-[#dcfce7]" : $tone === "error" ? "bg-[#fee2e2]" : "bg-[#fff3cd]"
      } ${className}`}
    />
  );
}

function Balance({ className = "", ...rest }: SpanProps) {
  return <span {...rest} className={`text-[#050505] text-[0.79rem] font-[850] ${className}`} />;
}

function Notice({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`mb-4 border-[1.5px] border-l-[5px] border-[#050505] border-l-[#f47a4a] rounded-[10px] bg-[#fff8f4] px-[0.78rem] py-[0.72rem] text-[rgba(5,5,5,0.74)] text-[0.74rem] font-[650] leading-[1.45] [&_strong]:text-[#050505] [&_strong]:font-black ${className}`}
    />
  );
}

function FormGrid({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-5 gap-y-4 max-[820px]:grid-cols-1 ${className}`}
    />
  );
}

function FormColumn({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`min-w-0 ${className}`} />;
}

function Field({
  as: As = "label",
  className = "",
  ...rest
}: { as?: "div" | "label" } & LabelHTMLAttributes<HTMLElement>) {
  return (
    <As
      {...rest}
      className={`grid gap-[0.4rem] mt-[0.9rem] first:mt-0 text-[#050505] text-[0.79rem] font-black ${className}`}
    />
  );
}

function Input({ className = "", ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={`w-full min-h-[42px] box-border border-2 border-[#050505] rounded-[10px] bg-white px-[0.7rem] py-[0.6rem] text-[#050505] text-[0.86rem] focus:outline-solid focus:outline-[3px] focus:outline-[#f47a4a] ${className}`}
    />
  );
}

function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`w-full min-h-[150px] box-border resize-y border-2 border-[#050505] rounded-[10px] bg-white px-[0.7rem] py-[0.65rem] text-[#050505] text-[0.86rem] leading-[1.5] focus:outline-solid focus:outline-[3px] focus:outline-[#f47a4a] ${className}`}
    />
  );
}

function FieldHint({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`mx-0 mt-[-0.05rem] mb-0 text-[rgba(5,5,5,0.56)] text-[0.7rem] font-semibold ${className}`}
    />
  );
}

function MemberPicker({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`overflow-hidden border-2 border-[#050505] rounded-[10px] bg-white ${className}`}
    />
  );
}

const searchWrapSvgClasses =
  "[&_svg]:absolute [&_svg]:top-1/2 [&_svg]:left-[0.7rem] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:translate-y-[-50%] [&_svg]:text-[rgba(5,5,5,0.52)]";

function SearchWrap({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`relative border-b-[1.5px] border-[#050505] ${searchWrapSvgClasses} ${className}`}
    />
  );
}

function SearchInput({ className = "", ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={`w-full min-h-[40px] box-border border-0 rounded-none bg-white py-[0.6rem] pr-[0.7rem] pl-[2.1rem] text-[#050505] text-[0.86rem] focus:outline-none ${className}`}
    />
  );
}

function RecipientList({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`max-h-[235px] overflow-y-auto ${className}`} />;
}

function RecipientRow({
  $selected,
  $disabled,
  className = "",
  ...rest
}: { $selected: boolean; $disabled?: boolean } & LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...rest}
      className={`flex items-center gap-[0.7rem] min-h-[48px] border-b border-[rgba(5,5,5,0.14)] px-[0.72rem] py-[0.55rem] last:border-b-0 [&_input]:w-4 [&_input]:h-4 [&_input]:accent-[#f47a4a] ${
        $selected ? "bg-[#fff1ea]" : "bg-white"
      } ${
        $disabled
          ? "cursor-not-allowed opacity-[0.52] hover:bg-white"
          : "cursor-pointer hover:bg-[#fff8f4]"
      } ${className}`}
    />
  );
}

function Avatar({ className = "", ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={`grid w-7 h-7 flex-none place-items-center overflow-hidden rounded-full bg-[#f47a4a] text-[#050505] text-[0.7rem] font-[850] [&_img]:w-full [&_img]:h-full [&_img]:object-cover ${className}`}
    />
  );
}

function RecipientText({ className = "", ...rest }: SpanProps) {
  return <span {...rest} className={`grid min-w-0 gap-[0.08rem] ${className}`} />;
}

function RecipientName({ className = "", ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={`overflow-hidden text-[#050505] text-[0.81rem] font-extrabold text-ellipsis whitespace-nowrap ${className}`}
    />
  );
}

function RecipientMeta({ className = "", ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={`overflow-hidden text-[rgba(5,5,5,0.55)] text-[0.67rem] font-[650] text-ellipsis whitespace-nowrap ${className}`}
    />
  );
}

function EmptyRecipients({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`m-0 px-3 py-5 text-[rgba(5,5,5,0.54)] text-[0.8rem] text-center ${className}`}
    />
  );
}

function SecondaryButton({ className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-[42px] items-center justify-center gap-[0.35rem] border-2 border-[#050505] rounded-[10px] bg-white px-[0.68rem] py-[0.55rem] shadow-[2px_2px_0_#050505] text-[#050505] cursor-pointer text-[0.75rem] font-black [&:hover:not(:disabled)]:[transform:translate(-1px,-1px)] [&:hover:not(:disabled)]:bg-[#fff1ea] [&:hover:not(:disabled)]:shadow-[3px_3px_0_#050505] disabled:cursor-not-allowed disabled:opacity-[0.55] [&_svg]:w-[0.95rem] [&_svg]:h-[0.95rem] ${className}`}
    />
  );
}

function ProductCard({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid grid-cols-[74px_minmax(0,1fr)] gap-[0.8rem] mt-[0.8rem] border-[1.5px] border-[#050505] rounded-[12px] bg-[#fff8f4] p-[0.72rem] ${className}`}
    />
  );
}

function ProductImage({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`w-[74px] h-[74px] overflow-hidden border-[1.5px] border-[#050505] rounded-[9px] bg-white [&_img]:w-full [&_img]:h-full [&_img]:object-cover ${className}`}
    />
  );
}

function ProductName({ className = "", ...rest }: HeadingProps) {
  return (
    <h3
      {...rest}
      className={`m-0 text-[#050505] text-[0.85rem] font-black leading-[1.35] ${className}`}
    />
  );
}

function ProductMeta({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`mx-0 mt-1 mb-0 text-[rgba(5,5,5,0.6)] text-[0.7rem] font-[650] leading-[1.4] ${className}`}
    />
  );
}

function ProductActions({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`flex flex-wrap gap-[0.55rem] ${className}`} />;
}

function FavoriteQuickPicks({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`grid grid-cols-2 gap-2 mt-[0.8rem] ${className}`} />;
}

function FavoriteQuickPick({ className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`grid grid-cols-[28px_minmax(0,1fr)] items-center gap-[0.42rem] overflow-hidden border-[1.5px] border-[#050505] rounded-[9px] bg-[#fffef4] p-[0.4rem] text-[#050505] cursor-pointer text-left [&:hover:not(:disabled)]:bg-[#fff1ea] disabled:cursor-wait disabled:opacity-60 ${className}`}
    />
  );
}

function FavoriteQuickImage({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`w-7 h-7 overflow-hidden rounded-[6px] bg-[#fff8f4] [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_svg]:w-full [&_svg]:h-full [&_svg]:box-border [&_svg]:p-[0.35rem] [&_svg]:text-[#f47a4a] ${className}`}
    />
  );
}

function FavoriteQuickText({ className = "", ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={`overflow-hidden text-[#050505] text-[0.68rem] font-[850] text-ellipsis whitespace-nowrap ${className}`}
    />
  );
}

function ManualLookup({ className = "", ...rest }: HTMLAttributes<HTMLDetailsElement>) {
  return (
    <details
      {...rest}
      className={`mt-[0.7rem] [&_summary]:w-fit [&_summary]:cursor-pointer [&_summary]:text-[rgba(5,5,5,0.68)] [&_summary]:text-[0.72rem] [&_summary]:font-extrabold ${className}`}
    />
  );
}

function ManualLookupRow({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-[0.55rem] mt-2 ${className}`}
    />
  );
}

function ModalBackdrop({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`fixed z-[1000] inset-0 grid place-items-center bg-[rgba(5,5,5,0.56)] p-4 ${className}`}
    />
  );
}

function ModalCard({ className = "", ...rest }: SectionProps) {
  return (
    <section
      {...rest}
      className={`grid grid-rows-[auto_minmax(0,1fr)_auto] w-[min(760px,100%)] max-h-[min(620px,calc(100vh-2rem))] overflow-hidden border-[3px] border-[#050505] rounded-[16px] bg-white shadow-[7px_7px_0_#050505] ${className}`}
    />
  );
}

function ModalHeader({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex items-start justify-between gap-4 border-b-2 border-[#050505] px-[1.1rem] py-4 ${className}`}
    />
  );
}

function ModalTitle({ className = "", ...rest }: HeadingProps) {
  return <h3 {...rest} className={`m-0 text-[#050505] text-[1rem] font-[950] ${className}`} />;
}

function ModalDescription({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`mx-0 mt-1 mb-0 text-[rgba(5,5,5,0.62)] text-[0.73rem] font-[650] leading-[1.45] ${className}`}
    />
  );
}

function IconButton({ className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`grid w-[34px] h-[34px] flex-none place-items-center border-2 border-[#050505] rounded-[8px] bg-white text-[#050505] cursor-pointer hover:bg-[#fff1ea] [&_svg]:w-4 [&_svg]:h-4 ${className}`}
    />
  );
}

function CatalogTools({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`border-b-[1.5px] border-[rgba(5,5,5,0.18)] p-[0.7rem] ${className}`}
    />
  );
}

function CatalogSearch({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`relative border-2 border-[#050505] rounded-[10px] ${searchWrapSvgClasses} ${className}`}
    />
  );
}

function CatalogSearchInput({ className = "", ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={`w-full min-h-[40px] box-border border-0 rounded-[8px] bg-white py-[0.6rem] pr-[0.7rem] pl-[2.1rem] text-[#050505] text-[0.86rem] focus:outline-none ${className}`}
    />
  );
}

function CatalogBody({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid min-h-0 grid-cols-[188px_minmax(0,1fr)] max-[620px]:grid-cols-[145px_minmax(0,1fr)] ${className}`}
    />
  );
}

function BrandPanel({ className = "", ...rest }: SectionProps) {
  return (
    <aside
      {...rest}
      className={`grid grid-rows-[auto_minmax(0,1fr)] min-h-0 overflow-hidden border-r-2 border-[#050505] bg-[#fff8f4] ${className}`}
    />
  );
}

function BrandList({ className = "", ...rest }: DivProps) {
  return (
    <div {...rest} className={`min-h-0 max-h-full overflow-y-auto p-[0.35rem] ${className}`} />
  );
}

function BrandButton({
  $selected,
  className = "",
  ...rest
}: { $selected: boolean } & ButtonProps) {
  return (
    <button
      {...rest}
      className={`block w-full overflow-hidden border-0 rounded-[7px] px-[0.58rem] py-[0.55rem] text-[#050505] cursor-pointer text-[0.72rem] font-[850] text-left text-ellipsis whitespace-nowrap ${
        $selected ? "bg-[#f47a4a] hover:bg-[#f47a4a]" : "bg-transparent hover:bg-[#fff1ea]"
      } ${className}`}
    />
  );
}

function CatalogItems({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`min-h-0 overflow-y-auto p-[0.85rem] ${className}`} />;
}

function CatalogGrid({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid grid-cols-2 gap-[0.7rem] max-[480px]:grid-cols-1 ${className}`}
    />
  );
}

function CatalogProduct({
  $selected,
  $disabled,
  className = "",
  ...rest
}: { $selected: boolean; $disabled: boolean } & DivProps) {
  return (
    <div
      {...rest}
      className={`relative grid grid-cols-[58px_minmax(0,1fr)] gap-[0.65rem] w-full min-h-[86px] items-center border-2 border-[#050505] rounded-[11px] p-[0.58rem] text-[#050505] text-left ${
        $selected ? "bg-[#fff1ea]" : "bg-white"
      } ${
        $disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:border-[#f47a4a] hover:bg-[#fff8f4]"
      } ${className}`}
    />
  );
}

function FavoriteToggle({
  $active,
  className = "",
  ...rest
}: { $active: boolean } & ButtonProps) {
  return (
    <button
      {...rest}
      className={`absolute top-[0.38rem] right-[0.38rem] grid w-[25px] h-[25px] place-items-center border border-[#050505] rounded-full text-[#050505] cursor-pointer disabled:cursor-wait disabled:opacity-[0.55] [&_svg]:w-[0.86rem] [&_svg]:h-[0.86rem] ${
        $active ? "bg-[#fef08a]" : "bg-white"
      } ${className}`}
    />
  );
}

function CatalogItemsHeader({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex items-center justify-between gap-[0.65rem] mb-[0.7rem] ${className}`}
    />
  );
}

function CatalogBrandName({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`m-0 overflow-hidden text-[#050505] text-[0.78rem] font-black text-ellipsis whitespace-nowrap ${className}`}
    />
  );
}

function SortSelect({ className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={`min-h-8 max-w-[168px] border-[1.5px] border-[#050505] rounded-[8px] bg-white px-[0.4rem] py-[0.3rem] text-[#050505] text-[0.68rem] font-extrabold ${className}`}
    />
  );
}

function CatalogImage({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`w-[58px] h-[58px] overflow-hidden border border-[rgba(5,5,5,0.35)] rounded-[8px] bg-[#fff8f4] [&_img]:w-full [&_img]:h-full [&_img]:object-cover ${className}`}
    />
  );
}

function CatalogText({ className = "", ...rest }: SpanProps) {
  return <span {...rest} className={`grid min-w-0 gap-[0.14rem] ${className}`} />;
}

function CatalogName({ className = "", ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={`overflow-hidden text-[0.76rem] font-black leading-[1.32] text-ellipsis whitespace-nowrap ${className}`}
    />
  );
}

function CatalogMeta({ className = "", ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={`overflow-hidden text-[rgba(5,5,5,0.6)] text-[0.67rem] font-[650] text-ellipsis whitespace-nowrap ${className}`}
    />
  );
}

function CatalogFooter({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex items-center justify-between gap-3 border-t-[1.5px] border-[rgba(5,5,5,0.18)] px-[1.1rem] py-[0.85rem] max-[560px]:flex-col max-[560px]:items-stretch ${className}`}
    />
  );
}

function CatalogStatus({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex items-center text-[rgba(5,5,5,0.64)] text-[0.72rem] font-extrabold ${className}`}
    />
  );
}

function CatalogActions({ className = "", ...rest }: DivProps) {
  return (
    <div {...rest} className={`flex gap-[0.55rem] max-[560px]:[&>button]:flex-1 ${className}`} />
  );
}

function TwoColumns({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid grid-cols-[1fr_1fr] gap-[0.65rem] max-[540px]:grid-cols-1 ${className}`}
    />
  );
}

function SubmitRow({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex items-center justify-between gap-3 mt-[1.1rem] border-t-[1.5px] border-[rgba(5,5,5,0.16)] pt-4 max-[560px]:flex-col max-[560px]:items-stretch ${className}`}
    />
  );
}

function SendButton({ className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`min-h-[42px] border-2 border-[#050505] rounded-[10px] bg-[#f47a4a] px-[0.9rem] py-[0.65rem] shadow-[3px_3px_0_#050505] text-[#050505] cursor-pointer text-[0.81rem] font-black [&:hover:not(:disabled)]:[transform:translate(-1px,-1px)] [&:hover:not(:disabled)]:bg-[#f88d63] [&:hover:not(:disabled)]:shadow-[4px_4px_0_#050505] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${className}`}
    />
  );
}

function InlineStatus({
  $error,
  className = "",
  ...rest
}: { $error?: boolean } & ParagraphProps) {
  return (
    <p
      {...rest}
      className={`m-0 text-[0.75rem] font-extrabold leading-[1.4] ${
        $error ? "text-[#991b1b]" : "text-[#0f6b32]"
      } ${className}`}
    />
  );
}

function HistoryWrap({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`overflow-x-auto ${className}`} />;
}

function HistoryTable({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`min-w-[880px] ${className}`} />;
}

const historyGridClasses =
  "grid grid-cols-[150px_minmax(150px,1.05fr)_minmax(220px,1.5fr)_105px_125px_minmax(170px,1fr)] gap-[0.8rem] items-center";

function HistoryRow({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`${historyGridClasses} border-b border-[rgba(5,5,5,0.14)] py-[0.72rem] last:border-b-0 ${className}`}
    />
  );
}

function HistoryHeaderRow({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`${historyGridClasses} border-b-2 border-[#050505] pt-0 pb-[0.72rem] text-[rgba(5,5,5,0.58)] text-[0.68rem] font-black tracking-[0.03em] ${className}`}
    />
  );
}

function HistoryPrimary({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`min-w-0 text-[#050505] text-[0.78rem] font-[850] leading-[1.4] ${className}`}
    />
  );
}

function HistorySecondary({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`mt-[0.15rem] overflow-hidden text-[rgba(5,5,5,0.55)] text-[0.67rem] font-[650] leading-[1.35] text-ellipsis whitespace-nowrap ${className}`}
    />
  );
}

function Status({
  $status,
  className = "",
  ...rest
}: { $status: AdminGiftHistoryItem["status"] } & SpanProps) {
  return (
    <span
      {...rest}
      className={`inline-flex w-fit border border-[#050505] rounded-full px-[0.44rem] py-[0.22rem] text-[#050505] text-[0.64rem] font-black ${
        $status === "sent"
          ? "bg-[#dcfce7]"
          : $status === "pending"
            ? "bg-[#fff3cd]"
            : $status === "cancelled_after_timeout"
              ? "bg-[#e0f2fe]"
              : "bg-[#fee2e2]"
      } ${className}`}
    />
  );
}

function ProviderError({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`mt-[0.15rem] text-[#991b1b] text-[0.65rem] font-[750] leading-[1.35] ${className}`}
    />
  );
}

function EmptyState({ className = "", ...rest }: ParagraphProps) {
  return (
    <p
      {...rest}
      className={`m-0 px-2 py-[1.4rem] text-[rgba(5,5,5,0.54)] text-[0.78rem] font-bold text-center ${className}`}
    />
  );
}

function LoadingState({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`grid min-h-[260px] place-items-center text-[rgba(5,5,5,0.6)] text-[0.88rem] font-extrabold ${className}`}
    />
  );
}

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

// A typed-in phone number is one recipient; an empty field is none.
function customRecipientCount(phone: string): number {
  return phone.trim() ? 1 : 0;
}

// Why nothing can be sent yet: the provider is not configured, or no product is chosen.
function sendBlockedReason(
  data: AdminGiftsData | null,
  product: AdminGiftProduct | null,
  copy: GiftsCopy,
): string | null {
  if (!data?.configured) return data?.configurationError || copy.providerNeedsSetup;
  if (!product) return copy.productRequired;
  return null;
}

// Money (KRW) and timestamp formatting in the admin's locale.
function useGiftFormat() {
  const { t, locale } = useI18n();
  const unavailable = t.admin.gifts.unavailable;
  const formatMoney = (value: number | null) =>
    value === null ? unavailable : MONEY_FORMAT[locale].format(value);
  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return DATE_TIME_FORMAT[locale].format(date);
  };
  return { formatMoney, formatDate };
}

// Whether the gift provider is configured, the prepaid balance, and a refresh button.
function ProviderStatus({
  data,
  isRefreshing,
  onRefresh,
  copy,
}: {
  data: AdminGiftsData | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  copy: GiftsCopy;
}) {
  const { formatMoney } = useGiftFormat();
  return (
    <ProviderInfo>
      <Pill $tone={data?.configured ? "ok" : "error"}>
        {data?.configured ? copy.providerReady : copy.providerNeedsSetup}
      </Pill>
      <Balance>
        {copy.balanceLabel}: {formatMoney(data?.balance ?? null)}
      </Balance>
      {data?.balanceError && <Pill $tone="warn">{copy.balanceUnavailable}</Pill>}
      <SecondaryButton type="button" onClick={onRefresh} disabled={isRefreshing}>
        <ArrowPathIcon />
        {copy.refresh}
      </SecondaryButton>
    </ProviderInfo>
  );
}

// One-click picks for products the admins starred in the catalog.
function FavoritePicks({
  favorites,
  disabled,
  onPick,
  copy,
}: {
  favorites: AdminGiftFavorite[];
  disabled: boolean;
  onPick: (goodsCode: string) => void;
  copy: GiftsCopy;
}) {
  if (favorites.length === 0) return null;
  return (
    <>
      <FieldHint>{copy.quickPicks}</FieldHint>
      <FavoriteQuickPicks>
        {favorites.map((favorite) => (
          <FavoriteQuickPick
            key={favorite.goodsCode}
            type="button"
            disabled={disabled}
            onClick={() => onPick(favorite.goodsCode)}
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
  );
}

// The product that will be sent: image, brand, purchase/list price, state and validity.
function SelectedProduct({ product, copy }: { product: AdminGiftProduct; copy: GiftsCopy }) {
  const { formatMoney } = useGiftFormat();
  const hasDiscount = product.salePrice !== null && product.discountPrice !== product.salePrice;
  return (
    <ProductCard>
      <ProductImage>
        {product.imageUrl ? <img src={product.imageUrl} alt="" /> : null}
      </ProductImage>
      <div>
        <ProductName>{product.goodsName}</ProductName>
        <ProductMeta>{product.brandName || product.goodsCode}</ProductMeta>
        <ProductMeta>
          {copy.purchasePrice}: {formatMoney(product.discountPrice ?? product.salePrice)}
          {hasDiscount ? ` · ${copy.listPrice}: ${formatMoney(product.salePrice)}` : ""}
        </ProductMeta>
        <ProductMeta>
          {copy.productState}: {product.state || copy.unavailable}
          {product.limitDay !== null
            ? ` · ${copy.validity}: ${product.limitDay}${copy.days}`
            : ""}
        </ProductMeta>
      </div>
    </ProductCard>
  );
}

// Choose the gift: browse the catalog, use a starred favorite, or enter a goods code,
// then show the chosen product.
function GiftProductChooser({
  canBrowse,
  isBrandLoading,
  onOpenCatalog,
  favorites,
  isLookingUp,
  onPickFavorite,
  goodsCode,
  onGoodsCodeChange,
  onLookup,
  product,
  copy,
}: {
  canBrowse: boolean;
  isBrandLoading: boolean;
  onOpenCatalog: () => void;
  favorites: AdminGiftFavorite[];
  isLookingUp: boolean;
  onPickFavorite: (goodsCode: string) => void;
  goodsCode: string;
  onGoodsCodeChange: (goodsCode: string) => void;
  onLookup: () => void;
  product: AdminGiftProduct | null;
  copy: GiftsCopy;
}) {
  return (
    <>
      <Field>
        {copy.productCodeLabel}
        <ProductActions>
          <SecondaryButton
            type="button"
            disabled={!canBrowse || isBrandLoading}
            onClick={onOpenCatalog}
          >
            <MagnifyingGlassIcon />
            {copy.lookupProduct}
          </SecondaryButton>
        </ProductActions>
        <FavoritePicks
          favorites={favorites}
          disabled={isLookingUp}
          onPick={onPickFavorite}
          copy={copy}
        />
        <ManualLookup>
          <summary>{copy.manualProductCode}</summary>
          <ManualLookupRow>
            <Input
              value={goodsCode}
              onChange={(event) => onGoodsCodeChange(event.target.value.toUpperCase())}
              placeholder={copy.productCodePlaceholder}
              autoCapitalize="characters"
            />
            <SecondaryButton
              type="button"
              disabled={!canBrowse || isLookingUp || !goodsCode.trim()}
              onClick={onLookup}
            >
              <MagnifyingGlassIcon />
              {isLookingUp ? copy.lookingUp : copy.lookupByCode}
            </SecondaryButton>
          </ManualLookupRow>
        </ManualLookup>
      </Field>

      {product && <SelectedProduct product={product} copy={copy} />}
    </>
  );
}

// One member in the recipient list; members without a phone, or past the batch limit,
// cannot be ticked.
function GiftRecipientOption({
  recipient,
  isSelected,
  limitReached,
  onToggle,
  copy,
}: {
  recipient: AdminGiftRecipient;
  isSelected: boolean;
  limitReached: boolean;
  onToggle: () => void;
  copy: GiftsCopy;
}) {
  const name = recipientName(recipient, copy.memberFallback);
  const disabled = !recipient.hasPhone || (!isSelected && limitReached);
  return (
    <RecipientRow $selected={isSelected} $disabled={disabled}>
      <input type="checkbox" checked={isSelected} disabled={disabled} onChange={onToggle} />
      <Avatar>
        {recipient.photoUrl ? <img src={recipient.photoUrl} alt="" /> : initials(name)}
      </Avatar>
      <RecipientText>
        <RecipientName>{name}</RecipientName>
        <RecipientMeta>{recipient.maskedPhone || copy.noPhone}</RecipientMeta>
      </RecipientText>
    </RecipientRow>
  );
}

// Either a custom phone number or up to MAX_BATCH_RECIPIENTS members, searchable.
function GiftRecipientPicker({
  recipients,
  matchingRecipients,
  search,
  onSearchChange,
  isCustomRecipient,
  onChooseCustom,
  selectedRecipientIds,
  onToggle,
  recipientCount,
  copy,
}: {
  recipients: AdminGiftRecipient[];
  matchingRecipients: AdminGiftRecipient[];
  search: string;
  onSearchChange: (value: string) => void;
  isCustomRecipient: boolean;
  onChooseCustom: () => void;
  selectedRecipientIds: string[];
  onToggle: (recipientId: string) => void;
  recipientCount: number;
  copy: GiftsCopy;
}) {
  const limitReached = selectedRecipientIds.length >= MAX_BATCH_RECIPIENTS;
  return (
    <Field as="div">
      {copy.recipientLabel}
      <MemberPicker>
        <SearchWrap>
          <MagnifyingGlassIcon />
          <SearchInput
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={copy.searchRecipients}
          />
        </SearchWrap>
        <RecipientList>
          <RecipientRow $selected={isCustomRecipient}>
            <input
              type="radio"
              name="gift-recipient"
              checked={isCustomRecipient}
              onChange={onChooseCustom}
            />
            <Avatar>+</Avatar>
            <RecipientText>
              <RecipientName>{copy.customRecipient}</RecipientName>
            </RecipientText>
          </RecipientRow>
          {matchingRecipients.length === 0 ? (
            <EmptyRecipients>{copy.noRecipients}</EmptyRecipients>
          ) : (
            matchingRecipients.map((recipient) => (
              <GiftRecipientOption
                key={recipient.id}
                recipient={recipient}
                isSelected={selectedRecipientIds.includes(recipient.id)}
                limitReached={limitReached}
                onToggle={() => onToggle(recipient.id)}
                copy={copy}
              />
            ))
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
  );
}

// Send result messages (or why sending is unavailable) and the send button.
function GiftSendBar({
  error,
  success,
  disabledReason,
  isSending,
  recipientCount,
  onSend,
  copy,
}: {
  error: string | null;
  success: string | null;
  disabledReason: string | null;
  isSending: boolean;
  recipientCount: number;
  onSend: () => void;
  copy: GiftsCopy;
}) {
  const showDisabledReason = !error && !success && disabledReason;
  return (
    <SubmitRow>
      <div>
        {error && <InlineStatus $error>{error}</InlineStatus>}
        {success && <InlineStatus>{success}</InlineStatus>}
        {showDisabledReason && <InlineStatus $error>{disabledReason}</InlineStatus>}
      </div>
      <SendButton type="button" disabled={isSending || Boolean(disabledReason)} onClick={onSend}>
        {isSending ? copy.sending : copy.sendGift.replace("{count}", String(recipientCount))}
      </SendButton>
    </SubmitRow>
  );
}

function GiftHistoryEntry({ gift, copy }: { gift: AdminGiftHistoryItem; copy: GiftsCopy }) {
  const { formatMoney, formatDate } = useGiftFormat();
  return (
    <HistoryRow>
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
  );
}

// Every gift sent so far, with provider status and order references.
function GiftHistory({ history, copy }: { history: AdminGiftHistoryItem[]; copy: GiftsCopy }) {
  if (history.length === 0) return <EmptyState>{copy.historyEmpty}</EmptyState>;
  return (
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
        {history.map((gift) => (
          <GiftHistoryEntry key={gift.id} gift={gift} copy={copy} />
        ))}
      </HistoryTable>
    </HistoryWrap>
  );
}

// Brand list in the catalog's left panel.
function CatalogBrands({
  isLoading,
  brands,
  selectedBrandCode,
  onSelect,
  copy,
}: {
  isLoading: boolean;
  brands: AdminGiftBrand[];
  selectedBrandCode: string | null;
  onSelect: (brandCode: string) => void;
  copy: GiftsCopy;
}) {
  if (isLoading) return <EmptyState>{copy.brandLoading}</EmptyState>;
  if (brands.length === 0) return <EmptyState>{copy.brandEmpty}</EmptyState>;
  return (
    <>
      {brands.map((brand) => (
        <BrandButton
          key={brand.brandCode}
          type="button"
          $selected={brand.brandCode === selectedBrandCode}
          onClick={() => onSelect(brand.brandCode)}
        >
          {brand.brandName}
        </BrandButton>
      ))}
    </>
  );
}

// One product tile; products not on sale can be seen and starred but not chosen.
function CatalogProductTile({
  product,
  isSelected,
  onSelect,
  isFavorite,
  isFavoriteUpdating,
  onToggleFavorite,
  copy,
}: {
  product: AdminGiftProduct;
  isSelected: boolean;
  onSelect: () => void;
  isFavorite: boolean;
  isFavoriteUpdating: boolean;
  onToggleFavorite: () => void;
  copy: GiftsCopy;
}) {
  const { formatMoney } = useGiftFormat();
  const unavailable = product.state !== "SALE";
  return (
    <CatalogProduct
      role="button"
      tabIndex={unavailable ? -1 : 0}
      aria-disabled={unavailable}
      $selected={isSelected}
      $disabled={unavailable}
      onClick={() => {
        if (!unavailable) onSelect();
      }}
      onKeyDown={(event) => {
        if (!unavailable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <FavoriteToggle
        type="button"
        $active={isFavorite}
        disabled={isFavoriteUpdating}
        aria-label={isFavorite ? copy.removeFavorite : copy.addFavorite}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {isFavorite ? <StarSolidIcon /> : <StarOutlineIcon />}
      </FavoriteToggle>
      <CatalogImage>
        {product.imageUrl ? <img src={product.imageUrl} alt="" /> : null}
      </CatalogImage>
      <CatalogText>
        <CatalogName>{product.goodsName}</CatalogName>
        <CatalogMeta>{product.goodsCode}</CatalogMeta>
        <CatalogMeta>
          {formatMoney(product.discountPrice ?? product.salePrice)}
          {unavailable ? ` · ${copy.catalogUnavailable}` : ""}
        </CatalogMeta>
      </CatalogText>
    </CatalogProduct>
  );
}

type CatalogProductsProps = {
  selectedBrand: AdminGiftBrand | null;
  products: AdminGiftProduct[];
  isProductsLoading: boolean;
  hasProducts: boolean;
  error: string | null;
  onRetry: () => void;
  selectedCode: string | null;
  onSelectCode: (goodsCode: string) => void;
  favoriteCodes: Set<string>;
  favoriteUpdatingCode: string | null;
  onToggleFavorite: (product: AdminGiftProduct) => void;
  copy: GiftsCopy;
};

// The chosen brand's products, or the prompt / loading / error state in their place.
function CatalogProducts({
  selectedBrand,
  products,
  isProductsLoading,
  hasProducts,
  error,
  onRetry,
  selectedCode,
  onSelectCode,
  favoriteCodes,
  favoriteUpdatingCode,
  onToggleFavorite,
  copy,
}: CatalogProductsProps) {
  if (!selectedBrand) return <EmptyState>{copy.catalogChooseBrand}</EmptyState>;
  if (isProductsLoading && !hasProducts) return <EmptyState>{copy.catalogLoading}</EmptyState>;
  if (error) {
    return (
      <>
        <InlineStatus $error>{error}</InlineStatus>
        <div style={{ marginTop: "0.8rem" }}>
          <SecondaryButton type="button" onClick={onRetry}>
            <ArrowPathIcon />
            {copy.retry}
          </SecondaryButton>
        </div>
      </>
    );
  }
  if (products.length === 0) return <EmptyState>{copy.catalogEmpty}</EmptyState>;
  return (
    <CatalogGrid>
      {products.map((product) => (
        <CatalogProductTile
          key={product.goodsCode}
          product={product}
          isSelected={selectedCode === product.goodsCode}
          onSelect={() => onSelectCode(product.goodsCode)}
          isFavorite={favoriteCodes.has(product.goodsCode)}
          isFavoriteUpdating={favoriteUpdatingCode === product.goodsCode}
          onToggleFavorite={() => onToggleFavorite(product)}
          copy={copy}
        />
      ))}
    </CatalogGrid>
  );
}

// Brand → product browser for picking the gift; Escape and the backdrop close it.
function GiftCatalogModal({
  brandSearch,
  onBrandSearchChange,
  isBrandLoading,
  brands,
  onSelectBrand,
  sort,
  onSortChange,
  isChoosing,
  onChoose,
  onClose,
  ...productsProps
}: CatalogProductsProps & {
  brandSearch: string;
  onBrandSearchChange: (value: string) => void;
  isBrandLoading: boolean;
  brands: AdminGiftBrand[];
  onSelectBrand: (brandCode: string) => void;
  sort: CatalogSort;
  onSortChange: (sort: CatalogSort) => void;
  isChoosing: boolean;
  onChoose: () => void;
  onClose: () => void;
}) {
  const { selectedBrand, products, isProductsLoading, selectedCode, copy } = productsProps;
  const status = !selectedBrand
    ? copy.catalogChooseBrand
    : isProductsLoading
      ? copy.catalogLoading
      : copy.catalogAvailableCount.replace("{count}", String(products.length));

  return (
    <ModalBackdrop role="presentation" onMouseDown={onClose}>
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
          <IconButton type="button" onClick={onClose} aria-label={copy.catalogClose}>
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
                  onChange={(event) => onBrandSearchChange(event.target.value)}
                  placeholder={copy.brandSearchPlaceholder}
                />
              </CatalogSearch>
            </CatalogTools>
            <BrandList>
              <CatalogBrands
                isLoading={isBrandLoading}
                brands={brands}
                selectedBrandCode={selectedBrand?.brandCode ?? null}
                onSelect={onSelectBrand}
                copy={copy}
              />
            </BrandList>
          </BrandPanel>

          <CatalogItems>
            {selectedBrand && (
              <CatalogItemsHeader>
                <CatalogBrandName>{selectedBrand.brandName}</CatalogBrandName>
                <SortSelect
                  value={sort}
                  onChange={(event) => onSortChange(event.target.value as CatalogSort)}
                  aria-label={copy.sortProducts}
                >
                  <option value="name">{copy.sortName}</option>
                  <option value="price-asc">{copy.sortPriceAsc}</option>
                  <option value="price-desc">{copy.sortPriceDesc}</option>
                </SortSelect>
              </CatalogItemsHeader>
            )}
            <CatalogProducts {...productsProps} />
          </CatalogItems>
        </CatalogBody>

        <CatalogFooter>
          <CatalogStatus>{status}</CatalogStatus>
          <CatalogActions>
            <SecondaryButton type="button" onClick={onClose}>
              {copy.catalogClose}
            </SecondaryButton>
            <SendButton
              type="button"
              disabled={!selectedCode || isChoosing || isProductsLoading}
              onClick={onChoose}
            >
              {isChoosing ? copy.lookingUp : copy.catalogChoose}
            </SendButton>
          </CatalogActions>
        </CatalogFooter>
      </ModalCard>
    </ModalBackdrop>
  );
}

export default function AdminGiftsClient() {
  const { t } = useI18n();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
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
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("name");
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
    // app/admin/layout.tsx has already redirected non-admins on the server; this only
    // waits for the browser session so RLS sees it.
    if (authLoading || !currentUser || accountStatus !== "admin") return;
    void load();
  }, [accountStatus, authLoading, currentUser, load]);

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
    ? customRecipientCount(customPhone)
    : selectedRecipientIds.length;
  const sendDisabledReason = sendBlockedReason(data, product, copy);

  const { formatMoney } = useGiftFormat();

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

  const chooseProduct = async (goodsCode: string, closeCatalog = false) => {
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
    await chooseProduct(catalogSelectedCode, true);
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
              <ProviderStatus data={data} isRefreshing={isLoading} onRefresh={() => void load()} copy={copy} />
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
                  <GiftProductChooser
                    canBrowse={Boolean(data?.configured)}
                    isBrandLoading={isBrandLoading}
                    onOpenCatalog={openCatalog}
                    favorites={data?.favorites ?? []}
                    isLookingUp={isLookingUp}
                    onPickFavorite={(code) => void chooseProduct(code)}
                    goodsCode={goodsCode}
                    onGoodsCodeChange={setGoodsCode}
                    onLookup={() => void lookupProduct()}
                    product={product}
                    copy={copy}
                  />

                  <GiftRecipientPicker
                    recipients={recipients}
                    matchingRecipients={matchingRecipients}
                    search={recipientSearch}
                    onSearchChange={setRecipientSearch}
                    isCustomRecipient={isCustomRecipient}
                    onChooseCustom={() => {
                      setIsCustomRecipient(true);
                      setSelectedRecipientIds([]);
                    }}
                    selectedRecipientIds={selectedRecipientIds}
                    onToggle={toggleRecipient}
                    recipientCount={recipientCount}
                    copy={copy}
                  />

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

              <GiftSendBar
                error={sendError}
                success={sendSuccess}
                disabledReason={sendDisabledReason}
                isSending={isSending}
                recipientCount={recipientCount}
                onSend={() => void submit()}
                copy={copy}
              />
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
              <GiftHistory history={data?.history ?? []} copy={copy} />
            </CardBody>
          </Card>
        </Stack>
      )}

      {isCatalogOpen && (
        <GiftCatalogModal
          brandSearch={brandSearch}
          onBrandSearchChange={setBrandSearch}
          isBrandLoading={isBrandLoading}
          brands={matchingBrands}
          selectedBrand={selectedBrand}
          onSelectBrand={selectBrand}
          sort={catalogSort}
          onSortChange={setCatalogSort}
          products={matchingCatalogProducts}
          isProductsLoading={isBrandProductsLoading}
          hasProducts={Boolean(brandProducts)}
          error={catalogError}
          onRetry={() => (selectedBrandCode ? selectBrand(selectedBrandCode) : void loadBrands())}
          selectedCode={catalogSelectedCode}
          onSelectCode={setCatalogSelectedCode}
          favoriteCodes={favoriteCodes}
          favoriteUpdatingCode={favoriteUpdatingCode}
          onToggleFavorite={(catalogProduct) => void toggleFavorite(catalogProduct)}
          isChoosing={isLookingUp}
          onChoose={() => void selectCatalogProduct()}
          onClose={() => setIsCatalogOpen(false)}
          copy={copy}
        />
      )}
    </Page>
  );
}
