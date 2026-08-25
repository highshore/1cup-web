import { redirect } from "next/navigation";

import { createServerClientRSC } from "../lib/supabase/server";
import SpeakingTestClient from "./SpeakingTestClient";

export const metadata = {
  title: "English Speaking Test | 1 Cup English",
  description: "Take a TOEFL-inspired English speaking practice set and receive a CEFR-based report.",
};

export const dynamic = "force-dynamic";

export default async function SpeakingTestPage() {
  const supabase = await createServerClientRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?redirect=%2Fspeaking-test");

  return <SpeakingTestClient />;
}
