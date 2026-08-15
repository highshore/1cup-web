import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

type VoteValue = -1 | 0 | 1;

const identifier = (value: unknown, field: string, maxLength: number) => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(value) ||
    value.length > maxLength
  ) {
    throw new HttpsError("invalid-argument", field + " is invalid.");
  }
  return value;
};

const voteValue = (value: unknown): VoteValue => {
  if (value === -1 || value === 0 || value === 1) return value;
  throw new HttpsError("invalid-argument", "Vote must be -1, 0, or 1.");
};

const numericValue = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Stores one mutable vote per user/topic and maintains a server-owned aggregate.
 * The aggregate is safe to read publicly, while the callable enforces membership
 * and prevents clients from changing totals directly.
 */
export const voteDiscussionTopic = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in is required to vote.");
    }

    const data = (request.data || {}) as Record<string, unknown>;
    const articleId = identifier(data.articleId, "Article ID", 240);
    const topicId = identifier(data.topicId, "Topic ID", 120);
    const requestedVote = voteValue(data.vote);
    const uid = request.auth.uid;

    const member = await db.collection("users").doc(uid).get();
    if (member.data()?.hasActiveSubscription !== true) {
      throw new HttpsError(
        "permission-denied",
        "An active subscription is required to vote."
      );
    }

    const result = await db.runTransaction(async (transaction) => {
      const articleRef = db.collection("articles").doc(articleId);
      const articleSnapshot = await transaction.get(articleRef);
      if (!articleSnapshot.exists) {
        throw new HttpsError("not-found", "Article not found.");
      }

      const article = articleSnapshot.data() || {};
      const topics = Array.isArray(article.discussion_topics)
        ? article.discussion_topics.filter((topic): topic is string => typeof topic === "string")
        : [];
      const topicIds = Array.isArray(article.discussion_topic_ids)
        ? article.discussion_topic_ids.filter((id): id is string => typeof id === "string")
        : [];

      let topicIndex = topicIds.indexOf(topicId);
      if (topicIndex < 0) {
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
        throw new HttpsError("invalid-argument", "Discussion topic not found.");
      }

      const voteRef = db
        .collection("article_discussion_votes")
        .doc(articleId + "_" + topicId + "_" + uid);
      const statsRef = db
        .collection("article_discussion_stats")
        .doc(articleId + "_" + topicId);
      const [voteSnapshot, statsSnapshot] = await Promise.all([
        transaction.get(voteRef),
        transaction.get(statsRef),
      ]);

      const previousVote = voteSnapshot.exists
        ? voteValue(voteSnapshot.data()?.vote)
        : 0;
      const currentStats = statsSnapshot.data() || {};
      const upvotes = Math.max(
        0,
        numericValue(currentStats.upvotes) +
          (requestedVote === 1 ? 1 : 0) -
          (previousVote === 1 ? 1 : 0)
      );
      const downvotes = Math.max(
        0,
        numericValue(currentStats.downvotes) +
          (requestedVote === -1 ? 1 : 0) -
          (previousVote === -1 ? 1 : 0)
      );

      if (requestedVote === 0) {
        if (voteSnapshot.exists) transaction.delete(voteRef);
      } else {
        transaction.set(
          voteRef,
          {
            articleId,
            topicId,
            userId: uid,
            vote: requestedVote,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      const score = upvotes - downvotes;
      transaction.set(
        statsRef,
        {
          articleId,
          topicId,
          topicText,
          topicIndex,
          upvotes,
          downvotes,
          score,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { topicId, vote: requestedVote, upvotes, downvotes, score };
    });

    return result;
  }
);
