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

const clearFutureMeetupParticipation = async (uid: string) => {
  const db = admin();
  const { data: futureMeetups, error: futureMeetupsError } = await db
    .from("meetups")
    .select("id")
    .gte("date_time", new Date().toISOString());
  requireNoError(futureMeetupsError, "Unable to load upcoming meetups");

  const meetupIds = (futureMeetups ?? [])
    .map((meetup) => (typeof meetup.id === "string" ? meetup.id : null))
    .filter((id): id is string => Boolean(id));
  if (!meetupIds.length) return;

  const { error: removeError } = await db
    .from("meetup_participants")
    .delete()
    .eq("user_id", uid)
    .in("meetup_id", meetupIds);
  requireNoError(removeError, "Unable to leave upcoming meetups");

  await Promise.all(
    meetupIds.map(async (meetupId) => {
      const { count, error: countError } = await db
        .from("meetup_participants")
        .select("*", { count: "exact", head: true })
        .eq("meetup_id", meetupId);
      requireNoError(countError, "Unable to count meetup participants");
      const { error: updateError } = await db
        .from("meetups")
        .update({ current_participants: count ?? 0 })
        .eq("id", meetupId);
      requireNoError(updateError, "Unable to update meetup participant count");
    }),
  );
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
    .select("uid, auth_id, has_active_subscription, billing_cancelled, account_status")
    .eq("uid", uid)
    .maybeSingle();
  if (userError) return json(req, { error: "account_lookup_failed" }, 500);
  if (!user || user.account_status === "deleted") {
    return json(req, { error: "account_not_found" }, 404);
  }

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
    if (!authIds.length) throw new Error("No authentication identity found for this account.");

    await clearFutureMeetupParticipation(uid);

    // Clear user-generated social/private content and relationship edges. The remaining
    // meeting and accounting rows retain only an unlinked uid for aggregate history.
    const cleanupResults = await Promise.all([
      db.from("profile_likes").delete().or(`liker_id.eq.${uid},liked_id.eq.${uid}`),
      db.from("user_blocks").delete().or(`blocker_id.eq.${uid},blocked_user_id.eq.${uid}`),
      db.from("conversation_members").delete().eq("user_id", uid),
      db.from("messages").delete().eq("sender_id", uid),
      db.from("conversations").update({ created_by: null }).eq("created_by", uid),
      db.from("conversations").delete().eq("system_owner_user_id", uid),
      db.from("article_discussion_votes").delete().eq("user_id", uid),
      db.from("notification_reads").delete().eq("user_id", uid),
      db.from("notification_deliveries").delete().eq("user_id", uid),
      db
        .from("feedback")
        .update({ user_id: null, other_reason: null, survey: null })
        .eq("user_id", uid),
      db
        .from("speaking_reports")
        .update({ user_script: null, speaker_id: null, metadata: {} })
        .eq("user_id", uid),
      db.from("billing_stops").update({ reason: null }).eq("user_id", uid),
      db
        .from("payment_cancellations")
        .update({ reason: null, payple_response: {}, payple_error_message: null })
        .eq("user_id", uid),
      db
        .from("payment_orders")
        .update({
          billing_key_used: null,
          payment_result: {},
          payple_response: {},
          payple_params_attempted: {},
        })
        .eq("user_id", uid),
    ]);
    cleanupResults.forEach((result, index) =>
      requireNoError(result.error, `Unable to erase account data step ${index + 1}`),
    );

    const now = new Date().toISOString();
    const { error: profileError } = await db
      .from("users")
      .update({
        email: null,
        display_name: "Deleted member",
        photo_url: null,
        phone: null,
        kakao_id: null,
        auth_id: null,
        account_status: "deleted",
        user_type: null,
        gdg_member: false,
        has_active_subscription: false,
        plan_price: null,
        billing_key: null,
        payment_method: null,
        billing_cancelled: true,
        subscription_start_date: null,
        subscription_end_date: null,
        last_billing_date: null,
        billing_updated_at: null,
        cancellation_timestamp: now,
        cancellation_type: "account_deleted",
        cancellation_reason: null,
        cat_tech: false,
        cat_business: false,
        received_articles: [],
        last_received: null,
        left_count: null,
        saved_words: [],
        referral_code: null,
        referral_generated_at: null,
        bio: null,
        work: null,
        school: null,
        location: null,
        interests: null,
        profile_public: false,
        last_login_at: null,
        deleted_at: now,
        updated_at: now,
      })
      .eq("uid", uid);
    requireNoError(profileError, "Unable to anonymize the account profile");

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
