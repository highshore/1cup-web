"""Firestore Admin access for the growth agent.

Uses the Admin SDK (service account), which bypasses Firestore security rules —
so the agent can read/write the admin-only growth_* collections directly. The
data model mirrors app/lib/features/growth/types/growth_types.ts.
"""

import os
import time
import secrets

import firebase_admin
from firebase_admin import credentials, firestore

POSTS = "growth_posts"
ITERATIONS = "growth_iterations"
CONFIG = "growth_config"
CONFIG_DOC = "settings"
REFERRALS = "referrals"

_db = None


def _load_credentials():
    """Service account from GOOGLE_APPLICATION_CREDENTIALS, or inline env vars."""
    key_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if key_file and os.path.exists(key_file):
        return credentials.Certificate(key_file)

    private_key = (os.environ.get("FIREBASE_PRIVATE_KEY") or "").strip()
    if (private_key.startswith('"') and private_key.endswith('"')) or (
        private_key.startswith("'") and private_key.endswith("'")
    ):
        private_key = private_key[1:-1]
    private_key = private_key.replace("\\n", "\n")

    return credentials.Certificate(
        {
            "type": "service_account",
            "project_id": os.environ["FIREBASE_PROJECT_ID"],
            "client_email": os.environ["FIREBASE_CLIENT_EMAIL"],
            "private_key": private_key,
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    )


def db():
    global _db
    if _db is None:
        if not firebase_admin._apps:
            firebase_admin.initialize_app(_load_credentials())
        _db = firestore.client()
    return _db


def get_config() -> dict:
    snap = db().collection(CONFIG).document(CONFIG_DOC).get()
    data = snap.to_dict() if snap.exists else {}
    return {
        "agentActive": bool(data.get("agentActive", False)),
        "approveFirst": data.get("approveFirst", True),
    }


def recent_posts(channel: str, limit: int = 20) -> list[dict]:
    """Most recent posts for a channel, newest first, as plain dicts."""
    q = (
        db()
        .collection(POSTS)
        .where("channel", "==", channel)
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )
    out = []
    for doc in q.stream():
        d = doc.to_dict()
        d["id"] = doc.id
        out.append(d)
    return out


def posts_by_status(channel: str, status: str) -> list[dict]:
    q = (
        db()
        .collection(POSTS)
        .where("channel", "==", channel)
        .where("status", "==", status)
    )
    out = []
    for doc in q.stream():
        d = doc.to_dict()
        d["id"] = doc.id
        out.append(d)
    return out


def new_tracking_code() -> str:
    return secrets.token_hex(4)


def create_draft(channel: str, content: dict, variant: dict, iteration_id: str) -> dict:
    """content: {title, body, hook}. Returns the stored post dict (with id)."""
    now = firestore.SERVER_TIMESTAMP
    code = new_tracking_code()
    post = {
        "channel": channel,
        "title": content.get("title", ""),
        "content": content.get("body", ""),
        "variant": variant,
        "trackingCode": code,
        "status": "draft",
        "iterationId": iteration_id,
        "metrics": {"clicks": 0, "signups": 0},
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db().collection(POSTS).add(post)[1]
    # Seed the referral doc so /r/<code> can increment it.
    db().collection(REFERRALS).document(code).set(
        {"postId": ref.id, "channel": channel, "visits": 0, "signups": 0,
         "createdAt": now},
        merge=True,
    )
    return {"id": ref.id, "trackingCode": code, **post}


def log_iteration(channel: str, observation: str, decision: str,
                  strategy_change: str, variant: dict, model: str,
                  post_id: str = "") -> str:
    ref = db().collection(ITERATIONS).add(
        {
            "channel": channel,
            "observation": observation,
            "decision": decision,
            "strategyChange": strategy_change,
            "variant": variant,
            "model": model,
            "postId": post_id,
            "runAt": firestore.SERVER_TIMESTAMP,
        }
    )[1]
    return ref.id


def mark_posted(post_id: str, external_url: str) -> None:
    db().collection(POSTS).document(post_id).update(
        {
            "status": "posted",
            "externalUrl": external_url,
            "postedAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )


def mark_failed(post_id: str, reason: str) -> None:
    db().collection(POSTS).document(post_id).update(
        {"status": "failed", "failureReason": reason[:500],
         "updatedAt": firestore.SERVER_TIMESTAMP}
    )


def days_since_last_post(channel: str) -> float:
    """Days since the most recent *posted* item on this channel (inf if none)."""
    q = (
        db()
        .collection(POSTS)
        .where("channel", "==", channel)
        .where("status", "==", "posted")
        .order_by("postedAt", direction=firestore.Query.DESCENDING)
        .limit(1)
    )
    for doc in q.stream():
        posted_at = doc.to_dict().get("postedAt")
        if posted_at is None:
            return float("inf")
        return (time.time() - posted_at.timestamp()) / 86400.0
    return float("inf")
