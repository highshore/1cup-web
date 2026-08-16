// discussion-vote — port of the Cloud Function `voteDiscussionTopic`
// (functions/src/voteDiscussionTopic.ts).
//
// One mutable vote per member per topic, with a server-owned aggregate that is safe to
// read publicly. Membership is enforced here so clients can never move the totals.
//
// Firestore ran a transaction that read the old vote, adjusted the counters and wrote
// both documents. Postgres lets the aggregate be *derived* instead: the vote is upserted
// and public.recount_discussion_topic() recomputes the row from the votes table, so the
// totals cannot drift even if two votes land at once.
//
// POST { articleId, topicId, vote }   vote ∈ {-1, 0, 1}; 0 clears the vote.
import { preflight, json } from "../_shared/cors.ts";
import { admin, callerUid } from "../_shared/db.ts";

const identifier = (value: unknown, field: string, maxLength: number): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(value) ||
    value.length > maxLength
  ) {
    throw new Error(`${field} is invalid.`);
  }
  return value;
};

const voteValue = (value: unknown): -1 | 0 | 1 => {
  if (value === -1 || value === 0 || value === 1) return value;
  throw new Error("Vote must be -1, 0, or 1.");
};

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const uid = await callerUid(req);
  if (!uid) {
    return json(req, { error: "unauthenticated", message: "Sign in is required to vote." }, 401);
  }

  let articleId: string, topicId: string, requestedVote: -1 | 0 | 1;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    articleId = identifier(body.articleId, "Article ID", 240);
    topicId = identifier(body.topicId, "Topic ID", 120);
    requestedVote = voteValue(body.vote);
  } catch (e) {
    return json(req, { error: "invalid-argument", message: (e as Error).message }, 400);
  }

  const a = admin();

  const { data: member } = await a
    .from("users")
    .select("has_active_subscription")
    .eq("uid", uid)
    .maybeSingle();
  if (member?.has_active_subscription !== true) {
    return json(
      req,
      { error: "permission-denied", message: "An active subscription is required to vote." },
      403,
    );
  }

  const { data: article } = await a
    .from("articles")
    .select("discussion_topics, discussion_topic_ids")
    .eq("id", articleId)
    .maybeSingle();
  if (!article) return json(req, { error: "not-found", message: "Article not found." }, 404);

  const topics: string[] = Array.isArray(article.discussion_topics)
    ? (article.discussion_topics as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  const topicIds: string[] = Array.isArray(article.discussion_topic_ids)
    ? (article.discussion_topic_ids as unknown[]).filter((t): t is string => typeof t === "string")
    : [];

  let topicIndex = topicIds.indexOf(topicId);
  if (topicIndex < 0) {
    // Older articles have no explicit ids; the client addresses them as topic-<n>.
    const legacyMatch = /^topic-(\d+)$/.exec(topicId);
    if (legacyMatch) {
      const candidate = Number(legacyMatch[1]);
      if (Number.isInteger(candidate) && candidate >= 0 && candidate < topics.length) {
        topicIndex = candidate;
      }
    }
  }

  const topicText = topics[topicIndex]?.trim();
  if (!topicText) {
    return json(req, { error: "invalid-argument", message: "Discussion topic not found." }, 400);
  }

  if (requestedVote === 0) {
    const { error } = await a
      .from("article_discussion_votes")
      .delete()
      .eq("article_id", articleId)
      .eq("topic_id", topicId)
      .eq("user_id", uid);
    if (error) return json(req, { error: "internal", message: error.message }, 500);
  } else {
    const { error } = await a.from("article_discussion_votes").upsert(
      {
        article_id: articleId,
        topic_id: topicId,
        user_id: uid,
        vote: requestedVote,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "article_id,topic_id,user_id" },
    );
    if (error) return json(req, { error: "internal", message: error.message }, 500);
  }

  const { error: recountErr } = await a.rpc("recount_discussion_topic", {
    p_article_id: articleId,
    p_topic_id: topicId,
  });
  if (recountErr) return json(req, { error: "internal", message: recountErr.message }, 500);

  // Keep the descriptive columns fresh; the counts come from the recount above.
  await a
    .from("article_discussion_stats")
    .update({ topic_text: topicText, topic_index: topicIndex })
    .eq("article_id", articleId)
    .eq("topic_id", topicId);

  const { data: stats } = await a
    .from("article_discussion_stats")
    .select("upvotes, downvotes, score")
    .eq("article_id", articleId)
    .eq("topic_id", topicId)
    .maybeSingle();

  return json(req, {
    topicId,
    vote: requestedVote,
    upvotes: stats?.upvotes ?? 0,
    downvotes: stats?.downvotes ?? 0,
    score: stats?.score ?? 0,
  });
});
