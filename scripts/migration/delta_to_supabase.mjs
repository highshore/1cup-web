// Delta sync Firestore -> Supabase over PostgREST (service-role), for the data that
// accumulated in Firebase after the 2026-07-26 export.
//
// Same field mapping as load_to_supabase.mjs, but it talks to the REST API with the
// service-role key instead of opening a Postgres connection, so it needs no DB password.
// Everything is an upsert keyed on the natural PK, so it is idempotent and also picks up
// rows that were *updated* in Firebase, not just new ones.
//
// Usage:
//   node firestore_to_ndjson_prod.mjs        # refresh ../data first
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node delta_to_supabase.mjs [--apply]
//
// Without --apply it only reports what it would write.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR } from "./_data_dir.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = DATA_DIR;
const APPLY = process.argv.includes("--apply");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const rows = (file) => {
  const p = join(DATA, `${file}.ndjson`);
  if (!existsSync(p)) { console.warn(`  skip ${file} (no file)`); return []; }
  return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
};
const ts = (v) => (v ? new Date(v).toISOString() : null);
const pcd = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k.startsWith("PCD_")));

const _articleIds = new Set(rows("articles").map((a) => a.__id));
const _userIds = new Set(rows("users").map((u) => u.__id));
const _meetupIds = new Set(rows("meetup").map((m) => m.__id));
const _topicIds = new Set(rows("communityTopics").map((t) => t.__id));
const inSet = (v, s) => (v && s.has(v) ? v : null);

const stats = [];

// Upsert in chunks. `conflict` is the comma-joined natural key.
async function push(table, list, conflict) {
  if (!list.length) { stats.push([table, 0, 0, ""]); return; }
  if (!APPLY) { stats.push([table, list.length, 0, "dry-run"]); return; }
  let written = 0, note = "";
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500);
    const { error } = await sb.from(table).upsert(chunk, { onConflict: conflict });
    if (error) {
      // A dangling FK means the parent was deleted in Firebase; retry row-by-row so one
      // bad row does not drop the whole chunk.
      let dropped = 0;
      for (const row of chunk) {
        const { error: e2 } = await sb.from(table).upsert(row, { onConflict: conflict });
        if (e2) dropped++; else written++;
      }
      if (dropped) note = `${dropped} row(s) skipped (${error.code || error.message})`;
    } else {
      written += chunk.length;
    }
  }
  stats.push([table, list.length, written, note]);
}

console.log(APPLY ? "applying delta…" : "dry run (pass --apply to write)…");

// 1. users (referral_code is set in a second pass so the FK to referral_codes holds)
await push("users", rows("users").map((u) => ({
  uid: u.__id, email: u.email, display_name: u.displayName,
  photo_url: u.photoURL ? String(u.photoURL).replace(/^http:\/\//, "https://") : u.photoURL,
  phone: u.phone ?? u.phone_number, kakao_id: u.kakaoId,
  account_status: u.account_status, user_type: u.user_type, gdg_member: !!u.gdg_member,
  has_active_subscription: !!u.hasActiveSubscription, plan_price: u.plan_price ?? null,
  billing_key: u.billingKey, payment_method: u.paymentMethod,
  subscription_start_date: ts(u.subscriptionStartDate), subscription_end_date: ts(u.subscriptionEndDate),
  last_billing_date: ts(u.lastBillingDate), billing_updated_at: ts(u.billingUpdatedAt),
  billing_cancelled: !!u.billingCancelled, cancellation_timestamp: ts(u.cancellationTimestamp),
  cancellation_type: u.cancellationType, cancellation_reason: u.cancellationReason,
  cat_tech: !!u.cat_tech, cat_business: !!u.cat_business,
  received_articles: u.received_articles ?? [], last_received: ts(u.last_received),
  left_count: u.left_count ?? null, saved_words: u.saved_words ?? [],
  referral_generated_at: ts(u.referralGeneratedAt),
  bio: u.bio, work: u.work, school: u.school, location: u.location, interests: u.interests,
  profile_public: u.profilePublic !== false,
  created_at: ts(u.createdAt), updated_at: ts(u.updatedAt), last_login_at: ts(u.lastLoginAt),
})), "uid");

// 2. referral_codes, then the users.referral_code backfill
await push("referral_codes", rows("referral_codes").map((r) => ({
  code: r.__id, active: r.active ?? true, discount: r.discount ?? null,
  type: r.type, referrer: r.referrer ?? null, created_at: ts(r.createdAt),
})), "code");

if (APPLY) {
  let n = 0;
  for (const u of rows("users")) {
    if (!u.referralCode) continue;
    const { error } = await sb.from("users").update({ referral_code: u.referralCode }).eq("uid", u.__id);
    if (!error) n++;
  }
  stats.push(["users.referral_code (backfill)", n, n, ""]);
}

// 3. payments
await push("payment_orders", rows("payment_orders").map((o) => ({
  order_number: o.orderNumber ?? o.__id, user_id: o.userId, amount: o.amount ?? null,
  status: o.status, type: o.type, referral_code: o.referralCode ?? null,
  billing_key_used: o.billingKeyUsed, payment_method: o.paymentMethod,
  related_auth_order: o.relatedAuthOrder ?? null,
  selected_categories: o.selectedCategories ?? null, payment_result: o.paymentResult ?? null,
  payple_response: pcd(o), payple_params_attempted: o.paypleParamsAttempted ?? null,
  error_code: o.errorCode, error_message: o.errorMessage,
  order_date: ts(o.orderDate), completed_at: ts(o.completedAt), failed_at: ts(o.failedAt),
  created_at: ts(o.createdAt),
})), "order_number");

await push("payment_cancellations", rows("payment_cancellations").map((c) => ({
  id: c.__id, user_id: c.userId, original_order_id: c.originalOrderId, status: c.status,
  reason: c.reason, refund_amount_attempted: c.refundAmountAttempted ?? null,
  refund_amount_processed: c.refundAmountProcessed ?? null,
  payple_error_code: c.paypleErrorCode, payple_error_message: c.paypleErrorMessage,
  payple_response: c.paypleResponse ?? pcd(c), requested_at: ts(c.requestedAt),
})), "id");

await push("billing_stops", rows("billing_stops").map((b) => ({
  id: b.__id, user_id: b.userId, reason: b.reason, status: b.status,
  original_end_date: ts(b.originalEndDate), requested_at: ts(b.requestedAt),
})), "id");

// 4. articles (+ keywords junction). figures is a real column again.
const articles = rows("articles");
await push("articles", articles.map((a) => ({
  id: a.__id, title: a.title ?? null, content: a.content ?? null, url: a.url,
  source_url: a.source_url, image_url: a.image_url, audio: a.audio ?? null,
  timestamps: a.timestamps ?? null, discussion_topics: a.discussion_topics ?? null,
  pronunciation_keywords: a.pronunciation_keywords ?? null,
  figures: a.figures ?? null, timestamp: ts(a.timestamp),
  created_at: ts(a.createdAt ?? a.timestamp),
})), "id");
await push("article_keywords",
  articles.flatMap((a) => (a.keywords ?? []).map((w) => ({ article_id: a.__id, word: String(w) }))),
  "article_id,word");
await push("article_meanings", rows("article_meanings").map((m) => ({
  article_id: m.__parent, word: m.word ?? m.__id, definition: m.definition,
})), "article_id,word");

// 5. meetups + junctions
const meetups = rows("meetup");
await push("meetups", meetups.map((m) => ({
  id: m.__id, title: m.title, description: m.description, date_time: ts(m.date_time),
  duration_minutes: m.duration_minutes ?? null, lockdown_minutes: m.lockdown_minutes ?? null,
  max_participants: m.max_participants ?? null, current_participants: m.current_participants ?? null,
  image_urls: m.image_urls ?? [], location_name: m.location_name,
  location_address: m.location_address, location_map_url: m.location_map_url,
  location_extra_info: m.location_extra_info, latitude: m.latitude ?? null,
  longitude: m.longitude ?? null, topics: m.topics ?? null,
  seating_arrangement: m.seatingArrangement ?? null, assignments: m.assignments ?? null,
  generated_at: ts(m.generatedAt), generated_by: m.generatedBy ?? null, created_at: ts(m.createdAt),
})), "id");
await push("meetup_participants", meetups.flatMap((m) => [
  ...(m.leaders ?? []).map((uid) => ({ meetup_id: m.__id, user_id: uid, role: "leader" })),
  ...(m.participants ?? []).map((uid) => ({ meetup_id: m.__id, user_id: uid, role: "participant" })),
]), "meetup_id,user_id");
await push("meetup_articles", meetups.flatMap((m) =>
  (m.articles ?? []).map((aid) => ({ meetup_id: m.__id, article_id: String(aid) }))),
  "meetup_id,article_id");

// 6. transcripts + speaking reports
await push("transcripts", rows("transcripts").map((t) => ({
  id: t.__id, event_id: inSet(t.eventId, _meetupIds), article_id: inSet(t.articleId, _articleIds),
  created_by: inSet(t.createdBy, _userIds), session_number: t.sessionNumber ?? null,
  report_count: t.reportCount ?? null, leader_uids: t.leaderUids ?? [],
  participant_uids: t.participantUids ?? [], custom_keywords: t.customKeywords ?? [],
  speaker_mappings: t.speakerMappings ?? null, transcript_content: t.transcriptContent ?? null,
  transcript_metadata: t.transcriptMetadata ?? null,
  hide_unidentified_speakers: !!t.hideUnidentifiedSpeakers, reports_generated: !!t.reportsGenerated,
  preserve_spacing: t.preserveSpacing ?? null, total_words: t.totalWords ?? null,
  total_recording_duration: t.totalRecordingDuration ?? null,
  total_paused_duration: t.totalPausedDuration ?? null, created_at: ts(t.createdAt),
  reports_generated_at: ts(t.reportsGeneratedAt), last_updated: ts(t.lastUpdated),
})), "id");

const reportRows = [...rows("reports"), ...rows("users_speaking_reports")]
  .filter((r) => r.transcriptId && r.userId)
  .map((r) => ({
    transcript_id: r.transcriptId, user_id: r.userId, speaker_id: r.speakerId,
    user_script: r.userScript, analysis: r.analysis ?? null, metadata: r.metadata ?? null,
    created_at: ts(r.createdAt),
  }));
await push("speaking_reports", reportRows, "transcript_id,user_id");

// 7. feedback, blog, community, celebrations
await push("feedback", rows("feedback").map((f) => {
  const isSurvey = f.q1_meetup_participation !== undefined;
  return {
    id: f.__id, kind: isSurvey ? "survey" : (f.category ?? "cancellation"),
    user_id: inSet(f.userId ?? f.uid, _userIds), category: f.category,
    survey: isSurvey ? {
      q1_meetup_participation: f.q1_meetup_participation, q2_recommendation: f.q2_recommendation,
      q3_disappointment: f.q3_disappointment, q4_speaking_difficulty: f.q4_speaking_difficulty,
      q5_improvement_suggestions: f.q5_improvement_suggestions,
    } : null,
    reasons: f.reasons ?? null, other_reason: f.otherReason, created_at: ts(f.createdAt ?? f.timestamp),
  };
}), "id");

const seenSlugs = new Set();
const blog = rows("blog_posts");
await push("blog_posts", blog.map((b) => {
  let slug = String(b.slug ?? "").trim();
  if (!slug || slug === "-" || seenSlugs.has(slug)) slug = null;
  if (slug) seenSlugs.add(slug);
  return {
    id: b.__id, title: b.title, slug, excerpt: b.excerpt, content: b.content,
    featured_image: b.featuredImage, category: b.category, status: b.status ?? "draft",
    tags: b.tags ?? [], featured: !!b.featured, views: b.views ?? 0, likes: b.likes ?? 0,
    created_at: ts(b.createdAt), updated_at: ts(b.updatedAt), published_at: ts(b.publishedAt),
  };
}), "id");
await push("blog_post_likes",
  blog.flatMap((b) => (b.likedBy ?? []).map((uid) => ({ post_id: b.__id, user_id: uid }))),
  "post_id,user_id");

await push("community_topics", rows("communityTopics").map((t) => ({
  id: t.__id, title: t.title, content: t.content, author: t.author,
  author_id: inSet(t.authorId, _userIds), likes: t.likes ?? 0, liked_by: t.likedBy ?? [],
  created_at: ts(t.createdAt),
})), "id");
await push("community_comments", rows("communityComments").map((c) => ({
  id: c.__id, topic_id: inSet(c.topicId, _topicIds), content: c.content, author: c.author,
  author_id: inSet(c.authorId, _userIds), likes: c.likes ?? 0, liked_by: c.likedBy ?? [],
  created_at: ts(c.createdAt),
})), "id");
await push("community_announcements", rows("communityAnnouncements").map((a) => ({
  id: a.__id, payload: a, created_at: ts(a.createdAt),
})), "id");
await push("celebrations", rows("celebrations").map((c) => ({
  id: c.__id, member_name: c.memberName, headline: c.headline, description: c.description,
  logo_url: c.logoUrl, order: c.order ?? null, achieved_at: ts(c.achievedAt),
})), "id");

// 8. dictionaries / singletons
await push("cefr", rows("cefr").map((c) => ({
  word: c.__id, level: c.level, source: c.source, freq: c.freq ?? null,
  first_seen_at: ts(c.firstSeenAt), updated_at: ts(c.updatedAt),
})), "word");
await push("cefr_runs", rows("cefr_runs").map((r) => ({
  id: r.__id, status: r.status, total: r.total ?? null, counts: r.counts ?? null,
  unique_counts: r.uniqueCounts ?? null, words_by_level: r.wordsByLevel ?? null,
  existing: r.existing ?? null, acronyms: r.acronyms ?? null, pending: r.pending ?? null,
  created_at: ts(r.createdAt),
})), "id");
await push("words", rows("words").map((w) => ({
  word: w.__id, categories: w.categories ?? null, definitions: w.definitions ?? null,
  examples: w.examples ?? null, synonyms: w.synonyms ?? [], antonyms: w.antonyms ?? [],
})), "word");
await push("links", rows("links").map((l) => ({
  category: l.__id, url: l.url, updated_at: ts(l.updated_at),
})), "category");
await push("shadow", rows("shadow").map((s) => ({
  id: s.__id, youtube_url: s.youtube_url ?? s.youtubeUrl,
  audio_timestamps: s.audio_timestamps ?? s.audioTimestamps ?? null,
})), "id");

console.log("\ntable                              source   written  note");
for (const [t, src, w, note] of stats) {
  console.log(`${t.padEnd(34)} ${String(src).padStart(6)} ${String(w).padStart(8)}  ${note}`);
}
console.log(APPLY ? "\ndone." : "\ndry run only — nothing was written.");
