import type { Metadata } from "next";

import AdminDiscountCodesClient from "./AdminDiscountCodesClient";

export const metadata: Metadata = {
  title: "Discount Codes - Admin - OneCup English",
  description: "Create and manage OneCup English discount and referral codes",
};

export default function AdminDiscountCodesPage() {
  return <AdminDiscountCodesClient />;
}
