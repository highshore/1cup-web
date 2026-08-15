# Article and Voting Function Guide

- Keep article processing in `createAdminArticle.ts` and voting in `voteDiscussionTopic.ts`; both use the Admin SDK and must validate all callable inputs.
- Article figures must not enter any Vertex model request. Generated covers are stored in Firebase Storage and published only after successful generation.
- Vote aggregates belong in `article_discussion_stats`; individual votes belong in `article_discussion_votes`. Update both only inside the server transaction and preserve one record per user/topic.
