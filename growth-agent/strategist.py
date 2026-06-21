"""The strategist: Claude decides the next ad variant from performance history.

It acts as an LLM-driven multi-armed bandit — it sees which content "arms"
(hook angle, tone, CTA, post time) produced the most *signups* (the ground
truth) and balances exploiting what works against exploring new angles. It only
authors the high-leverage, varying parts of a post (subject + opening hook);
the proven structural copy (schedule, pricing, links) is templated by each
channel adapter, so the model can't drift the facts.
"""

import os
import json

import anthropic

MODEL = os.environ.get("GROWTH_MODEL", "claude-opus-4-8")

# Stable context about the meetup so the model writes on-brand, accurate copy.
MEETUP_CONTEXT = """\
영어 한잔 (1cupenglish.com) is an offline English discussion meetup in Seoul.
- Members read high-end English articles (WSJ, FT) and debate them, 2 hours, tables of ≤5.
- Led by an interpreter with ~5 years at large corporates / IT unicorns.
- Target: TOEIC 900 / OPIc AL / TOEFL 105 level, or strong motivation; people aiming
  for study-abroad, immigration, global careers; interest in geopolitics / economics / IT / medicine.
- Sundays 11:15am, Anam (안암동) cafe. Paid signup on the website (low monthly fee, full refund within 7 days).
- Connected to (not part of) Korea University's Google Developers Group; IT backgrounds welcome but not required.
The channel is koreapas.com's free-ad board (코리아패스 freead) — a Korean community board.
Write in natural Korean. The audience is Korean university students / young professionals.
"""

# Structured output schema — the model returns exactly these fields.
SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "observation": {
            "type": "string",
            "description": "What the performance history shows (which variants drove signups/clicks).",
        },
        "decision": {
            "type": "string",
            "description": "What to try next and why (explore vs exploit reasoning).",
        },
        "strategyChange": {
            "type": "string",
            "description": "The explicit change from the previous post's strategy.",
        },
        "variant": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "hook": {"type": "string", "description": "Short label for the hook angle, e.g. 'career-ROI'."},
                "angle": {"type": "string"},
                "tone": {"type": "string"},
                "cta": {"type": "string"},
                "postTime": {"type": "string", "description": "Intended time of day, e.g. 'morning'."},
            },
            "required": ["hook", "angle", "tone", "cta", "postTime"],
        },
        "subject": {
            "type": "string",
            "description": "The post title/subject line in Korean. Punchy, no clickbait lies.",
        },
        "hookHtml": {
            "type": "string",
            "description": (
                "The opening persuasive paragraph(s) as simple HTML (the part above the "
                "fixed schedule/pricing block). 2-5 short paragraphs. Korean. May use <br> and emoji. "
                "Do NOT include schedule, price, links, or the image — those are templated."
            ),
        },
    },
    "required": ["observation", "decision", "strategyChange", "variant", "subject", "hookHtml"],
}


def _history_digest(posts: list[dict]) -> str:
    """Compact, model-readable summary of past posts and their results."""
    if not posts:
        return "No prior posts yet. This is the first one — start with a strong, broadly-appealing angle."
    lines = []
    for p in posts[:12]:
        v = p.get("variant", {}) or {}
        m = p.get("metrics", {}) or {}
        lines.append(
            f"- [{p.get('status')}] subject={p.get('title','')!r} "
            f"hook={v.get('hook','?')} angle={v.get('angle','?')} tone={v.get('tone','?')} "
            f"-> clicks={m.get('clicks',0)} signups={m.get('signups',0)}"
        )
    return "\n".join(lines)


def decide(channel: str, history: list[dict]) -> dict:
    """Call Claude, return the validated decision dict (keys per SCHEMA)."""
    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

    system = (
        "You are the growth strategist for an English meetup. Each day you pick the next "
        "advertisement variant to post, learning from how prior variants performed. The reward "
        "that matters is SIGNUPS on the website (clicks are a weak secondary signal). Treat this "
        "as a multi-armed bandit: mostly exploit the hooks/angles/tones that drove signups, but "
        "regularly explore a new angle so you keep learning. Never fabricate facts (price, schedule, "
        "credentials) — only vary the persuasion. Keep it honest and non-spammy.\n\n"
        + MEETUP_CONTEXT
    )

    user = (
        f"Channel: {channel}\n\n"
        f"Performance history (newest first):\n{_history_digest(history)}\n\n"
        "Decide the next post. Return the structured fields. The hookHtml is only the opening "
        "pitch — the schedule, pricing, links, and image are added by a fixed template."
    )

    resp = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        thinking={"type": "adaptive"},
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        system=system,
        messages=[{"role": "user", "content": user}],
    )

    text = next(
        (b.text for b in reversed(resp.content) if getattr(b, "type", None) == "text"),
        None,
    )
    if not text:
        raise RuntimeError("Strategist returned no text block")
    return json.loads(text)
