// Transform NDJSON (from firestore_to_ndjson.mjs) into the Supabase schema and upsert.
//
// Usage:
//   SUPABASE_DB_URL='postgresql://postgres:[PWD]@db.[ref].supabase.co:5432/postgres' \
//     node load_to_supabase.mjs
//
// Run AFTER applying supabase_schema.sql. Loads in FK-dependency order and is
// idempotent (ON CONFLICT upsert), so it is safe to re-run.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { DATA_DIR } from "./_data_dir.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = DATA_DIR;
const { Client } = pg;

if (!process.env.SUPABASE_DB_URL) { console.error("set SUPABASE_DB_URL"); process.exit(1); }
const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });

const rows = (file) => {
  const p = join(DATA, `${file}.ndjson`);
  if (!existsSync(p)) { console.warn(`skip ${file} (no file)`); return []; }
  return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
};
const ts = (v) => (v ? new Date(v).toISOString() : null);
const pcd = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k.startsWith("PCD_")));
const lastSeg = (u) => (u ? String(u).split("/").filter(Boolean).pop() : null);

// jsonb columns: node-postgres serializes JS arrays as Postgres array literals ({…}),
// not JSON, so array-valued jsonb columns must be JSON.stringify'd before binding.
// (Objects are auto-stringified by pg, but we normalize all of them for consistency.)
//
// KEYED BY table.column, NOT by column name. The previous version matched on the bare
// name, so every `title`/`content` was stringified — including the TEXT columns
// meetups.title, blog_posts.title/content and community_*.title/content. Those landed in
// Postgres as JSON string literals: the value kept its surrounding double quotes and
// `\n` never became a real newline (95 rows had to be repaired on 2026-08-16 by
// supabase/migrations/20260816100000_unquote_json_encoded_text.sql in the web repo).
const JSONB = new Set([
  "payment_orders.selected_categories", "payment_orders.payment_result",
  "payment_orders.payple_response", "payment_orders.payple_params_attempted",
  "payment_cancellations.payple_response",
  "meetups.topics", "meetups.seating_arrangement", "meetups.assignments",
  "meetups.leader_details",
  "articles.title", "articles.content", "articles.audio", "articles.timestamps",
  "articles.discussion_topics", "articles.pronunciation_keywords", "articles.figures",
  "words.categories", "words.definitions", "words.examples",
  "en_dict.senses",
  "transcripts.speaker_mappings", "transcripts.transcript_content",
  "transcripts.transcript_metadata",
  "speaking_reports.analysis", "speaking_reports.metadata",
  "meetup_reports.transcripts", "meetup_reports.totals",
  "meetup_report_users.transcripts",
  "feedback.survey",
  "cefr_runs.counts", "cefr_runs.unique_counts", "cefr_runs.words_by_level",
  "cefr_runs.existing", "cefr_runs.acronyms", "cefr_runs.pending",
  "community_announcements.payload",
  "shadow.audio_timestamps",
]);

// child/junction rows dropped because their FK parent is missing in the source
// (delta data can reference since-deleted articles/users). Reported at the end.
const skipped = {};
const nonTable = {}; // rows targeted at a VIEW or a dropped table (auto-skipped)
let BASE_TABLES = null; // populated after connect; only real base tables are insertable

// generic upsert: cols = {colName: value}; conflict = array of pk cols.
// tolerateFk: on a dangling-FK violation, skip+count the row instead of aborting.
async function upsert(table, cols, conflict, tolerateFk = false) {
  // Skip targets that are views (meetup_reports, meetup_report_users) or dropped
  // (cache) in the live schema — their data is derived/obsolete.
  if (BASE_TABLES && !BASE_TABLES.has(table)) { nonTable[table] = (nonTable[table] || 0) + 1; return; }
  const keys = Object.keys(cols);
  const vals = keys.map((k) =>
    JSONB.has(`${table}.${k}`) && cols[k] != null ? JSON.stringify(cols[k]) : cols[k]);
  const ph = keys.map((_, i) => `$${i + 1}`).join(",");
  // Quote every identifier so reserved-word columns (e.g. "order") don't break the SQL.
  const colList = keys.map((k) => `"${k}"`).join(",");
  const conf = conflict.map((k) => `"${k}"`).join(",");
  const set = keys.filter((k) => !conflict.includes(k))
    .map((k) => `"${k}"=excluded."${k}"`).join(",");
  const fallback = `"${keys[0]}"=excluded."${keys[0]}"`;
  const sql = `insert into public.${table} (${colList}) values (${ph})
    on conflict (${conf}) do update set ${set || fallback}`;
  try {
    await client.query(sql, vals);
  } catch (e) {
    if (tolerateFk && e.code === "23503") { skipped[table] = (skipped[table] || 0) + 1; return; }
    throw e;
  }
}

await client.connect();
console.log("loading…");

// Only real base tables are insertable; views + dropped tables are skipped in upsert().
BASE_TABLES = new Set(
  (await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
  )).rows.map((r) => r.table_name),
);

// Valid parent-id sets, so "on delete set null" FK columns get NULL (not an abort)
// when they reference an empty string or a since-deleted parent in the delta data.
const _articleIds = new Set(rows("articles").map((a) => a.__id));
const _userIds = new Set(rows("users").map((u) => u.__id));
const _meetupIds = new Set(rows("meetup").map((m) => m.__id));
const _topicIds = new Set(rows("communityTopics").map((t) => t.__id));
const inSet = (v, s) => (v && s.has(v) ? v : null);

// 1. users
for (const u of rows("users")) {
  await upsert("users", {
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
    referral_code: null, // backfilled in step 2 to satisfy FK
    referral_generated_at: ts(u.referralGeneratedAt),
    bio: u.bio, work: u.work, school: u.school, location: u.location, interests: u.interests,
    profile_public: u.profilePublic !== false, // field absent in Firestore -> default visible (production behavior)
    created_at: ts(u.createdAt), updated_at: ts(u.updatedAt), last_login_at: ts(u.lastLoginAt),
  }, ["uid"]);
}

// 2. referral_codes, then backfill users.referral_code
for (const r of rows("referral_codes")) {
  await upsert("referral_codes", {
    code: r.__id, active: r.active ?? true, discount: r.discount ?? null,
    type: r.type, referrer: r.referrer ?? null, created_at: ts(r.createdAt),
  }, ["code"]);
}
for (const u of rows("users")) {
  if (u.referralCode)
    await client.query("update public.users set referral_code=$1 where uid=$2",
      [u.referralCode, u.__id]);
}

// 3. payments
for (const o of rows("payment_orders")) {
  await upsert("payment_orders", {
    order_number: o.orderNumber ?? o.__id, user_id: o.userId, amount: o.amount ?? null,
    status: o.status, type: o.type, referral_code: o.referralCode ?? null,
    billing_key_used: o.billingKeyUsed, payment_method: o.paymentMethod,
    related_auth_order: o.relatedAuthOrder ?? null,
    selected_categories: o.selectedCategories ?? null, payment_result: o.paymentResult ?? null,
    payple_response: pcd(o), payple_params_attempted: o.paypleParamsAttempted ?? null,
    error_code: o.errorCode, error_message: o.errorMessage,
    order_date: ts(o.orderDate), completed_at: ts(o.completedAt), failed_at: ts(o.failedAt),
    created_at: ts(o.createdAt),
  }, ["order_number"]);
}
for (const c of rows("payment_cancellations")) {
  await upsert("payment_cancellations", {
    id: c.__id, user_id: c.userId, original_order_id: c.originalOrderId, status: c.status,
    reason: c.reason, refund_amount_attempted: c.refundAmountAttempted ?? null,
    refund_amount_processed: c.refundAmountProcessed ?? null,
    payple_error_code: c.paypleErrorCode, payple_error_message: c.paypleErrorMessage,
    payple_response: c.paypleResponse ?? pcd(c), requested_at: ts(c.requestedAt),
  }, ["id"]);
}
for (const b of rows("billing_stops")) {
  await upsert("billing_stops", {
    id: b.__id, user_id: b.userId, reason: b.reason, status: b.status,
    original_end_date: ts(b.originalEndDate), requested_at: ts(b.requestedAt),
  }, ["id"]);
}

// 4. content: articles, words, junctions, links
for (const a of rows("articles")) {
  await upsert("articles", {
    id: a.__id, title: a.title ?? null, content: a.content ?? null, url: a.url,
    source_url: a.source_url, image_url: a.image_url, audio: a.audio ?? null,
    timestamps: a.timestamps ?? null, discussion_topics: a.discussion_topics ?? null,
    pronunciation_keywords: a.pronunciation_keywords ?? null, timestamp: ts(a.timestamp),
    created_at: ts(a.createdAt ?? a.timestamp),
  }, ["id"]);
  for (const w of a.keywords ?? [])
    await upsert("article_keywords", { article_id: a.__id, word: String(w) }, ["article_id", "word"], true);
}
for (const w of rows("words")) {
  await upsert("words", {
    word: w.__id, categories: w.categories ?? null, definitions: w.definitions ?? null,
    examples: w.examples ?? null, synonyms: w.synonyms ?? [], antonyms: w.antonyms ?? [],
  }, ["word"]);
}
for (const m of rows("article_meanings")) {
  await upsert("article_meanings",
    { article_id: m.__parent, word: m.word ?? m.__id, definition: m.definition },
    ["article_id", "word"], true);
}
for (const l of rows("links")) {
  await upsert("links", { category: l.__id, url: l.url, updated_at: ts(l.updated_at) }, ["category"]);
}

// 5. meetups + junctions  (source kind is "meetup")
for (const m of rows("meetup")) {
  await upsert("meetups", {
    id: m.__id, title: m.title, description: m.description, date_time: ts(m.date_time),
    duration_minutes: m.duration_minutes ?? null, lockdown_minutes: m.lockdown_minutes ?? null,
    max_participants: m.max_participants ?? null, current_participants: m.current_participants ?? null,
    image_urls: m.image_urls ?? [], location_name: m.location_name,
    location_address: m.location_address, location_map_url: m.location_map_url,
    location_extra_info: m.location_extra_info, latitude: m.latitude ?? null,
    longitude: m.longitude ?? null, topics: m.topics ?? null,
    seating_arrangement: m.seatingArrangement ?? null, assignments: m.assignments ?? null,
    generated_at: ts(m.generatedAt), generated_by: m.generatedBy ?? null, created_at: ts(m.createdAt),
  }, ["id"]);
  for (const uid of m.leaders ?? [])
    await upsert("meetup_participants", { meetup_id: m.__id, user_id: uid, role: "leader" }, ["meetup_id", "user_id"], true);
  for (const uid of m.participants ?? [])
    await upsert("meetup_participants", { meetup_id: m.__id, user_id: uid, role: "participant" }, ["meetup_id", "user_id"], true);
  for (const aid of m.articles ?? [])
    await upsert("meetup_articles", { meetup_id: m.__id, article_id: String(aid) }, ["meetup_id", "article_id"], true);
}

// 6. transcripts -> speaking_reports (merge top-level "reports" + users/*/speaking_reports)
for (const t of rows("transcripts")) {
  await upsert("transcripts", {
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
  }, ["id"]);
}
const loadReport = async (r) => {
  if (!r.transcriptId || !r.userId) return;
  await upsert("speaking_reports", {
    transcript_id: r.transcriptId, user_id: r.userId, speaker_id: r.speakerId,
    user_script: r.userScript, analysis: r.analysis ?? null, metadata: r.metadata ?? null,
    created_at: ts(r.createdAt),
  }, ["transcript_id", "user_id"], true);
};
for (const r of rows("reports")) await loadReport(r);
for (const r of rows("users_speaking_reports")) await loadReport(r); // subcollection dump

// 7. meetup_reports + per-user
for (const mr of rows("meetup_reports")) {
  await upsert("meetup_reports", {
    event_id: mr.eventId ?? mr.__id, transcripts: mr.transcripts ?? null,
    totals: mr.totals ?? null, updated_at: ts(mr.updatedAt),
  }, ["event_id"], true);
}
for (const u of rows("meetup_report_users")) {
  await upsert("meetup_report_users", {
    event_id: u.eventId ?? u.__parent, user_id: u.userId ?? u.__id,
    transcripts: u.transcripts ?? null, total_words: u.totalWords ?? null,
    total_speaking_duration: u.totalSpeakingDuration ?? null, average_wpm: u.averageWPM ?? null,
    sessions_count: u.sessionsCount ?? null, total_turns: u.totalTurns ?? null,
    weighted_avg_turn_sec: u.weightedAvgTurnSec ?? null, longest_turn_sec: u.longestTurnSec ?? null,
    weighted_avg_response_latency_sec: u.weightedAvgResponseLatencySec ?? null,
    weighted_lexical_diversity_pct: u.weightedLexicalDiversityPct ?? null,
    weighted_talk_time_share_pct: u.weightedTalkTimeSharePct ?? null,
    duration_share_pct: u.durationSharePct ?? null, avg_overall_score: u.avgOverallScore ?? null,
    updated_at: ts(u.updatedAt),
  }, ["event_id", "user_id"]);
}

// 8. feedback, blog, community, celebrations
for (const f of rows("feedback")) {
  const isSurvey = f.q1_meetup_participation !== undefined;
  await upsert("feedback", {
    id: f.__id, kind: isSurvey ? "survey" : (f.category ?? "cancellation"),
    user_id: inSet(f.userId ?? f.uid, _userIds), category: f.category,
    survey: isSurvey ? {
      q1_meetup_participation: f.q1_meetup_participation, q2_recommendation: f.q2_recommendation,
      q3_disappointment: f.q3_disappointment, q4_speaking_difficulty: f.q4_speaking_difficulty,
      q5_improvement_suggestions: f.q5_improvement_suggestions,
    } : null,
    reasons: f.reasons ?? null, other_reason: f.otherReason, created_at: ts(f.createdAt ?? f.timestamp),
  }, ["id"]);
}
const seenSlugs = new Set();
for (const b of rows("blog_posts")) {
  // slug is UNIQUE (nullable). Null out empty / "-" / duplicate slugs (NULLs are allowed).
  let slug = String(b.slug ?? "").trim();
  if (!slug || slug === "-" || seenSlugs.has(slug)) slug = null;
  if (slug) seenSlugs.add(slug);
  await upsert("blog_posts", {
    id: b.__id, title: b.title, slug, excerpt: b.excerpt, content: b.content,
    featured_image: b.featuredImage, category: b.category, status: b.status ?? "draft",
    tags: b.tags ?? [], featured: !!b.featured, views: b.views ?? 0, likes: b.likes ?? 0,
    created_at: ts(b.createdAt), updated_at: ts(b.updatedAt), published_at: ts(b.publishedAt),
  }, ["id"]);
  for (const uid of b.likedBy ?? [])
    await upsert("blog_post_likes", { post_id: b.__id, user_id: uid }, ["post_id", "user_id"], true);
}
for (const t of rows("communityTopics")) {
  await upsert("community_topics", {
    id: t.__id, title: t.title, content: t.content, author: t.author,
    author_id: inSet(t.authorId, _userIds), likes: t.likes ?? 0, liked_by: t.likedBy ?? [],
    created_at: ts(t.createdAt),
  }, ["id"]);
}
for (const c of rows("communityComments")) {
  await upsert("community_comments", {
    id: c.__id, topic_id: inSet(c.topicId, _topicIds), content: c.content, author: c.author,
    author_id: inSet(c.authorId, _userIds), likes: c.likes ?? 0, liked_by: c.likedBy ?? [],
    created_at: ts(c.createdAt),
  }, ["id"]);
}
for (const a of rows("communityAnnouncements"))
  await upsert("community_announcements", { id: a.__id, payload: a, created_at: ts(a.createdAt) }, ["id"]);
for (const c of rows("celebrations")) {
  await upsert("celebrations", {
    id: c.__id, member_name: c.memberName, headline: c.headline, description: c.description,
    logo_url: c.logoUrl, order: c.order ?? null, achieved_at: ts(c.achievedAt),
  }, ["id"]);
}

// 9. standalone dictionaries + singletons
for (const c of rows("cefr")) {
  await upsert("cefr", {
    word: c.__id, level: c.level, source: c.source, freq: c.freq ?? null,
    first_seen_at: ts(c.firstSeenAt), updated_at: ts(c.updatedAt),
  }, ["word"]);
}
for (const r of rows("cefr_runs")) {
  await upsert("cefr_runs", {
    id: r.__id, status: r.status, total: r.total ?? null, counts: r.counts ?? null,
    unique_counts: r.uniqueCounts ?? null, words_by_level: r.wordsByLevel ?? null,
    existing: r.existing ?? null, acronyms: r.acronyms ?? null, pending: r.pending ?? null,
    created_at: ts(r.createdAt),
  }, ["id"]);
}
for (const d of rows("en_dict")) {
  await upsert("en_dict", {
    headword: d.__id, en: d.en, ko: d.ko, pos: d.pos, label: d.label, order: d.order ?? null,
    senses: d.senses ?? null, examples: d.examples ?? null, definition: d.definition,
  }, ["headword"]);
}
for (const c of rows("cache")) {
  await upsert("cache", {
    id: c.__id, total_meetups: c.totalMeetups ?? null, total_members: c.totalMembers ?? null,
    total_articles: c.totalArticles ?? null, last_updated: ts(c.lastUpdated),
  }, ["id"]);
}
for (const s of rows("shadow")) {
  await upsert("shadow", { id: s.__id, youtube_url: s.youtube_url, audio_timestamps: s.audio_timestamps ?? null }, ["id"]);
}

await client.end();
if (Object.keys(skipped).length)
  console.log("skipped (dangling FK, parent missing in source):", JSON.stringify(skipped));
if (Object.keys(nonTable).length)
  console.log("skipped (target is a view / not a table):", JSON.stringify(nonTable));
console.log("done.");
