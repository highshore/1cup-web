// account-delete — self-service account erasure.
//
// Supabase Auth users are permanently deleted so no sign-in identity or session can
// be recovered. The public.users row is retained as an anonymized tombstone because
// payment and past-meetup rows reference its uid; those records keep operational
// history without retaining a profile, contact information, or auth identity.
import { preflight, json } from "../_shared/cors.ts";
import { admin, callerUid } from "../_shared/db.ts";

const CONFIRMATIONS = new Set(["DELETE ACCOUNT", "계정 삭제"]);

const requireNoError = (error: { message: string } | null, operation: string) => {
  if (error) throw new Error(`${operation}: ${error.message}`);
};

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";
  if (!CONFIRMATIONS.has(confirmation)) {
    return json(req, { error: "confirmation_required" }, 400);
  }

  const uid = await callerUid(req);
  if (!uid) return json(req, { error: "unauthenticated" }, 401);

  const db = admin();
  const { data: user, error: userError } = await db
    .from("users")
    .select("uid, auth_id, phone, has_active_subscription, billing_cancelled, account_status")
    .eq("uid", uid)
    .maybeSingle();
  if (userError) return json(req, { error: "account_lookup_failed" }, 500);
  if (!user) return json(req, { error: "account_not_found" }, 404);
  // An account already marked deleted used to be refused outright, which meant a run that
  // failed after anonymising the profile could never be finished: the auth identity stayed
  // behind, still able to sign in to an emptied profile. Let it through — the work below
  // is idempotent, and the identity check further down decides whether anything is left.
  const resuming = user.account_status === "deleted";

  // Billing is initiated by this app's recurring-payment worker. Require a completed
  // stop first, rather than making deletion silently abandon an active billing method.
  if (user.has_active_subscription === true && user.billing_cancelled !== true) {
    return json(req, { error: "billing_stop_required" }, 409);
  }

  try {
    const { data: identityRows, error: identitiesError } = await db
      .from("user_auth_identities")
      .select("auth_id")
      .eq("uid", uid);
    requireNoError(identitiesError, "Unable to load account identities");

    const authIds = Array.from(
      new Set(
        [...(identityRows ?? []).map((identity) => identity.auth_id), user.auth_id].filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        ),
      ),
    );
    if (!authIds.length) {
      // Resuming an interrupted run that had already got this far: the profile is erased
      // and no identity remains, so the account is gone. Report success rather than an
      // error the member can do nothing about.
      if (resuming) return json(req, { success: true, alreadyDeleted: true });
      throw new Error("No authentication identity found for this account.");
    }

    // One statement, one transaction. This was about twenty separate PostgREST calls, and
    // any one of them failing left the account half-erased with no way to finish the job.
    // Meetup departure, content erasure, accounting redaction and the tombstone now either
    // all land or none do.
    const { error: eraseError } = await db.rpc("delete_account_data", { p_uid: uid });
    requireNoError(eraseError, "Unable to erase the account data");

    // Avatar object names are uid-scoped. Ignore a missing file but surface other
    // storage failures before the auth identity is irrevocably deleted.
    const { error: avatarError } = await db.storage.from("avatars").remove([`${uid}/avatar.png`]);
    if (avatarError && !/not found|not exist/i.test(avatarError.message)) {
      throw new Error(`Unable to remove the profile image: ${avatarError.message}`);
    }

    for (const authId of authIds) {
      const { error: deleteAuthError } = await db.auth.admin.deleteUser(authId);
      requireNoError(deleteAuthError, "Unable to delete the authentication account");
    }

    const { error: unlinkError } = await db.from("user_auth_identities").delete().eq("uid", uid);
    requireNoError(unlinkError, "Unable to remove account identities");

    return json(req, { success: true });
  } catch (error) {
    console.error("Account deletion failed:", error);
    return json(req, { error: "account_deletion_failed" }, 500);
  }
});
