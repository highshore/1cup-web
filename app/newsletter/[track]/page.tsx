import { Metadata } from "next";
import { notFound } from "next/navigation";
import newsletter from "../../lib/i18n/newsletter";
import {
  isNewsletterTrack,
  NEWSLETTER_TRACKS,
} from "../../lib/features/newsletter/constants";
import TrackDetailClient from "./TrackDetailClient";

type Params = Promise<{ track: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return NEWSLETTER_TRACKS.map((track) => ({ track }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { track } = await params;
  if (!isNewsletterTrack(track)) return {};
  const copy = newsletter.ko.tracks[track];
  return {
    title: `${copy.title} | 1cup Daily`,
    description: copy.tagline,
    // Not indexed until subscriptions open.
    robots: { index: false, follow: false },
  };
}

export default async function NewsletterTrackPage({
  params,
}: {
  params: Params;
}) {
  const { track } = await params;
  if (!isNewsletterTrack(track)) notFound();
  return <TrackDetailClient track={track} />;
}
