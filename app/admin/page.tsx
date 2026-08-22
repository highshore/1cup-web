import { Metadata } from "next";
import AdminClient from "./AdminClient";
import AdminGiftShortcut from "./AdminGiftShortcut";

export const metadata: Metadata = {
  title: "Admin Portal - OneCup English",
  description: "OneCup English administration portal",
};

export default function AdminPage() {
  return (
    <>
      <AdminGiftShortcut />
      <AdminClient />
    </>
  );
}
