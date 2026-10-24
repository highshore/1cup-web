import type { Metadata } from "next";

import AdminAnalyticsClient from "./AdminAnalyticsClient";

export const metadata: Metadata = {
  title: "Business Dashboard - Admin - OneCup English",
  description: "Administrator-only revenue, customer retention and meetup analytics.",
};

export default function AdminAnalyticsPage() {
  return <AdminAnalyticsClient />;
}
