"""Cloud Run HTTP entry. Cloud Scheduler hits these on a daily cadence.

Endpoints:
  GET  /            health check
  POST /run         generate a new draft, then publish any approved drafts
  POST /generate    generate a new draft only
  POST /publish     publish approved drafts only

Protect with a shared secret: set RUN_TOKEN and Cloud Scheduler sends
`Authorization: Bearer <token>`. If RUN_TOKEN is unset, auth is skipped
(fine when the service is deployed with --no-allow-unauthenticated + IAM).
"""

import os

from dotenv import load_dotenv
from flask import Flask, request, jsonify

load_dotenv()

import agent  # noqa: E402

app = Flask(__name__)


def _authorized() -> bool:
    token = os.environ.get("RUN_TOKEN")
    if not token:
        return True
    return request.headers.get("Authorization") == f"Bearer {token}"


@app.get("/")
def health():
    return jsonify({"ok": True, "service": "growth-agent"})


@app.post("/run")
def run():
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401
    channel = (request.args.get("channel") or "koreapas")
    generated = agent.generate(channel)
    published = agent.publish_approved(channel)
    return jsonify({"generated": generated, "published": published})


@app.post("/generate")
def generate():
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401
    return jsonify(agent.generate(request.args.get("channel") or "koreapas"))


@app.post("/publish")
def publish():
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401
    return jsonify(agent.publish_approved(request.args.get("channel") or "koreapas"))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
