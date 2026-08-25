export type GiftSendStatus =
  | "pending"
  | "sent"
  | "failed"
  | "cancelled_after_timeout"
  | "timeout_unknown";

export interface AdminGiftRecipient {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  maskedPhone: string | null;
  hasPhone: boolean;
}

export interface AdminGiftProduct {
  goodsCode: string;
  goodsName: string;
  brandName: string | null;
  imageUrl: string | null;
  salePrice: number | null;
  discountPrice: number | null;
  state: string | null;
  limitDay: number | null;
}

export interface AdminGiftHistoryItem {
  id: string;
  trId: string;
  memberId: string | null;
  recipientName: string | null;
  recipientPhoneMasked: string | null;
  goodsCode: string;
  goodsName: string;
  brandName: string | null;
  goodsImageUrl: string | null;
  salePrice: number | null;
  purchasePrice: number | null;
  mmsTitle: string;
  mmsMessage: string;
  orderNo: string | null;
  providerCode: string | null;
  providerMessage: string | null;
  status: GiftSendStatus;
  createdAt: string;
  sentAt: string | null;
}

export interface AdminGiftsData {
  configured: boolean;
  configurationError: string | null;
  balance: number | null;
  balanceError: string | null;
  recipients: AdminGiftRecipient[];
  history: AdminGiftHistoryItem[];
  defaultProduct: AdminGiftProduct | null;
}

export interface SendAdminGiftInput {
  memberId: string | null;
  recipientName: string | null;
  phoneNumber: string | null;
  goodsCode: string;
  mmsTitle: string;
  mmsMessage: string;
}

export interface SendAdminGiftResult {
  gift: AdminGiftHistoryItem;
  balance: number | null;
}
