import { PolicyClient } from "./PolicyClient";

interface PolicyPageProps {
  params: Promise<{
    type: string;
  }>;
  searchParams: Promise<{
    service?: string | string[];
  }>;
}

// Generate static paths for policy pages
export async function generateStaticParams() {
  // Common policy types
  return [{ type: "privacy" }, { type: "terms" }, { type: "refund" }];
}

export default async function PolicyPage({ searchParams }: PolicyPageProps) {
  // ?service=daily shows the 영어 한잔 Daily terms or privacy notice.
  const { service } = await searchParams;
  return <PolicyClient service={typeof service === "string" ? service : undefined} />;
}
