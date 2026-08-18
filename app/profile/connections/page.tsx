import { Metadata } from "next";
import ConnectionsClient from "./ConnectionsClient";

export const metadata: Metadata = {
  title: "My connections | One Cup English",
  description: "Members you mutually connected with on One Cup English.",
};

export default function ConnectionsPage() {
  return <ConnectionsClient />;
}
