import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

/**
 * Resolve many Auth user records in batched `getUsers` calls instead of
 * one `getUser` per uid. Firebase allows up to 100 identifiers per call,
 * and the chunks themselves run concurrently within this one invocation.
 *
 * Returns a Map keyed by uid; uids not found in Auth are simply absent
 * (callers fall back as needed). Never throws — a failed chunk is logged
 * and skipped so partial results are still returned.
 */
export async function getAuthRecordsMap(
  uids: string[]
): Promise<Map<string, admin.auth.UserRecord>> {
  const map = new Map<string, admin.auth.UserRecord>();

  // De-duplicate and drop falsy uids before chunking.
  const unique = Array.from(new Set(uids.filter(Boolean)));
  if (unique.length === 0) return map;

  const CHUNK = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK) {
    chunks.push(unique.slice(i, i + CHUNK));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        return await admin
          .auth()
          .getUsers(chunk.map((uid) => ({ uid })));
      } catch (error) {
        logger.error(`getAuthRecordsMap chunk failed: ${error}`);
        return { users: [], notFound: [] } as admin.auth.GetUsersResult;
      }
    })
  );

  for (const result of results) {
    for (const record of result.users) {
      map.set(record.uid, record);
    }
  }

  return map;
}
