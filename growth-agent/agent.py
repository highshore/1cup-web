"""The growth loop.

generate(): observe history -> Claude picks the next variant -> write an
iteration log + a draft post. If approve-first is off, also publish it.

publish_approved(): post any admin-approved drafts to their channel and record
the result. This is what makes "approve-first" work — the agent drafts, the
admin approves in the dashboard, and the next run publishes.
"""

import os

import firestore_client as fs
import strategist
import adapters  # noqa: F401  (registers adapters on import)
from adapters import base

SITE_BASE_URL = os.environ.get("SITE_BASE_URL", "https://1cupenglish.com")
# Don't post more often than this per channel, regardless of triggers.
MIN_DAYS_BETWEEN_POSTS = float(os.environ.get("MIN_DAYS_BETWEEN_POSTS", "6"))


def tracked_url(code: str) -> str:
    return f"{SITE_BASE_URL}/r/{code}"


def generate(channel: str = "koreapas") -> dict:
    """Produce the next draft for a channel. Returns a summary dict."""
    config = fs.get_config()
    if not config["agentActive"]:
        return {"skipped": "agent inactive"}

    history = fs.recent_posts(channel, limit=20)
    decision = strategist.decide(channel, history)

    iteration_id = fs.log_iteration(
        channel=channel,
        observation=decision["observation"],
        decision=decision["decision"],
        strategy_change=decision["strategyChange"],
        variant=decision["variant"],
        model=strategist.MODEL,
    )

    adapter = base.get(channel)
    draft = fs.create_draft(
        channel=channel,
        content={"title": decision["subject"], "body": "", "hook": decision["hookHtml"]},
        variant=decision["variant"],
        iteration_id=iteration_id,
    )

    # Render the full body now (hook + template + tracked link) and store it so
    # the admin previews exactly what will post.
    body = adapter.build_body(
        decision["subject"], decision["hookHtml"], tracked_url(draft["trackingCode"])
    )
    fs.db().collection(fs.POSTS).document(draft["id"]).update({"content": body})

    result = {"channel": channel, "postId": draft["id"], "status": "draft",
              "subject": decision["subject"]}

    # Fully autonomous mode: publish immediately.
    if not config["approveFirst"]:
        published = _publish_one(channel, draft["id"], decision["subject"], body)
        result.update(published)

    return result


def publish_approved(channel: str = "koreapas") -> dict:
    """Publish all admin-approved drafts for a channel (respecting cadence)."""
    approved = fs.posts_by_status(channel, "approved")
    if not approved:
        return {"channel": channel, "published": 0, "note": "nothing approved"}

    published = []
    for post in approved:
        res = _publish_one(channel, post["id"], post.get("title", ""), post.get("content", ""))
        published.append({"postId": post["id"], **res})
        # One post per run is plenty for a free-ad board.
        if res.get("status") == "posted":
            break
    return {"channel": channel, "published": len(published), "results": published}


def _publish_one(channel: str, post_id: str, subject: str, body: str) -> dict:
    adapter = base.get(channel)

    days = fs.days_since_last_post(channel)
    if days < MIN_DAYS_BETWEEN_POSTS:
        return {"status": "skipped", "reason": f"posted {days:.1f}d ago (< {MIN_DAYS_BETWEEN_POSTS}d)"}

    if adapter.already_posted(subject):
        fs.mark_failed(post_id, "duplicate subject already on board")
        return {"status": "skipped", "reason": "duplicate on board"}

    try:
        url = adapter.post(subject, body)
        fs.mark_posted(post_id, url)
        return {"status": "posted", "externalUrl": url}
    except Exception as e:  # noqa: BLE001
        fs.mark_failed(post_id, str(e))
        return {"status": "failed", "error": str(e)}
