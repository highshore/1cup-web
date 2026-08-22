/* eslint-disable react-refresh/only-export-components -- Next.js route metadata */
import type { Metadata } from "next";

import AdminGiftsClient from "./AdminGiftsClient";

export const metadata: Metadata = {
  title: "Gifts - Admin - OneCup English",
  description: "Send and audit Giftishow Biz mobile coupon gifts",
};

export default function AdminGiftsPage() {
  return <AdminGiftsClient />;
}
