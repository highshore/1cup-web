// The payment Edge Function is the authoritative product catalog. Keep this small:
// these are intentionally product rules, not a general-purpose storefront.
export const PAYMENT_PRODUCTS = {
  membership_30d: {
    id: "membership_30d",
    paymentType: "subscription_initial_payment",
    displayName: "영어 한잔 30일 멤버십",
    price: 9700,
    recurring: true,
  },
  participation_pack_5: {
    id: "participation_pack_5",
    paymentType: "participation_pack_purchase",
    displayName: "영어 한잔 5회 참여권",
    price: 24500,
    credits: 5,
    validityDays: 180,
    recurring: false,
  },
} as const;

export type PaymentProductId = keyof typeof PAYMENT_PRODUCTS;

export function resolvePaymentProduct(value: unknown):
  (typeof PAYMENT_PRODUCTS)[PaymentProductId] {
  if (value === "participation_pack_5") return PAYMENT_PRODUCTS.participation_pack_5;
  return PAYMENT_PRODUCTS.membership_30d;
}
