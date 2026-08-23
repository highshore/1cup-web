# Growth Agent

A self-optimizing meetup-ad agent. Each run, Claude (`claude-opus-4-8`) reviews
how past ads performed — measured by **signups attributed on the website** — and
picks the next variant (hook / angle / tone / CTA / time), balancing exploit vs.
explore like a bandit. It writes a **draft** to Firestore; an admin approves it
in the web app's **Admin → Growth** tab; the next run **publishes** it to the
channel. Fully autonomous posting is available by turning off "approve-first".

```
Cloud Scheduler ──POST /run──> Cloud Run (this service)
                                  │  1. read growth_config + history (Firestore Admin SDK)
                                  │  2. strategist.decide()  → Claude opus-4-8
                                  │  3. write growth_iterations + growth_posts (draft)
                                  │  4. publish approved drafts → channel adapter (koreapas)
                                  └─ admin reviews/approves in the web Admin → Growth tab
```

## Layout

| File | Role |
|---|---|
| `main.py` | Flask HTTP entry (`/run`, `/generate`, `/publish`, `/`) |
| `agent.py` | The loop: generate draft, publish approved (cadence-guarded) |
| `strategist.py` | Claude call — structured-output decision (the "brain") |
| `firestore_client.py` | Admin SDK reads/writes for `growth_*` + `referrals` |
| `adapters/base.py` | Channel adapter interface + registry |
| `adapters/koreapas.py` | Koreapas poster (Selenium); LLM hook + fixed template |
| `Dockerfile` | Python + headless Chromium |

**Adding a channel** (LinkedIn/Reddit/Threads): implement `Adapter` in
`adapters/<name>.py`, `base.register(...)` it in `adapters/__init__.py`. The
loop, strategist, and dashboard are channel-agnostic.

## Local run

```bash
cd growth-agent
cp .env.example .env          # fill in real values; ROTATE the koreapas password
pip install -r requirements.txt
python main.py                # serves on :8080
# In another shell:
curl -XPOST localhost:8080/generate    # draft only (needs agentActive=true in Admin → Growth)
```

Set the agent on/off and approve-first in the web app's **Admin → Growth** tab
(writes `growth_config/settings`). The agent no-ops while `agentActive` is false.

## Deploy to Cloud Run + Scheduler

```bash
PROJECT=one-cup-eng
REGION=asia-northeast3

# 1. Store secrets in Secret Manager (one-time)
printf '%s' "$ANTHROPIC_API_KEY"   | gcloud secrets create growth-anthropic-key   --data-file=- --project $PROJECT
printf '%s' "$KOREAPAS_PASSWORD"   | gcloud secrets create growth-koreapas-pass   --data-file=- --project $PROJECT
printf '%s' "$FIREBASE_PRIVATE_KEY"| gcloud secrets create growth-fb-private-key   --data-file=- --project $PROJECT
printf '%s' "$RUN_TOKEN"           | gcloud secrets create growth-run-token        --data-file=- --project $PROJECT

# 2. Build + deploy (no public ingress; Scheduler invokes via IAM)
gcloud run deploy growth-agent \
  --source . --region $REGION --project $PROJECT \
  --no-allow-unauthenticated --memory 1Gi --cpu 1 --timeout 600 \
  --set-env-vars "FIREBASE_PROJECT_ID=$PROJECT,FIREBASE_CLIENT_EMAIL=$FIREBASE_CLIENT_EMAIL,KOREAPAS_USER_ID=highshore,SITE_BASE_URL=https://1cupenglish.com,GROWTH_MODEL=claude-opus-4-8" \
  --set-secrets "ANTHROPIC_API_KEY=growth-anthropic-key:latest,KOREAPAS_PASSWORD=growth-koreapas-pass:latest,FIREBASE_PRIVATE_KEY=growth-fb-private-key:latest,RUN_TOKEN=growth-run-token:latest"

URL=$(gcloud run services describe growth-agent --region $REGION --project $PROJECT --format 'value(status.url)')

# 3. Daily trigger (09:00 KST). Scheduler authenticates with its own OIDC
#    identity; also send the shared RUN_TOKEN as a belt-and-suspenders check.
gcloud scheduler jobs create http growth-daily \
  --location $REGION --project $PROJECT \
  --schedule "0 9 * * *" --time-zone "Asia/Seoul" \
  --uri "$URL/run" --http-method POST \
  --oidc-service-account-email "SCHEDULER_SA@$PROJECT.iam.gserviceaccount.com" \
  --headers "Authorization=Bearer $RUN_TOKEN"
```

Notes:
- The service account needs Firestore access (Datastore User) — reuse the web
  app's `firebase-adminsdk` SA, or grant a dedicated one.
- `--no-allow-unauthenticated` + the Scheduler OIDC identity keeps the endpoint
  private; `RUN_TOKEN` is a second gate inside the app.
- **Approve-first is the default.** Flip to autonomous only in **Admin → Growth**
  once you trust the drafts.

## Ground-truth attribution (Phase 3, separate)

Each draft gets a `trackingCode`; the body's CTA + image link point at
`SITE_BASE_URL/r/<code>`. The `/r/<code>` redirect and signup tagging live in the
Next.js app (Phase 3) — once shipped, `growth_posts.metrics.signups` fills in and
becomes the strategist's reward signal.

## Security

- No secrets in source. Credentials come from env / Secret Manager.
- **Rotate the koreapas password** — it was exposed in a chat transcript.
- The agent writes via the Admin SDK (bypasses Firestore rules); the web
  client is locked to admins by the retained legacy rules in `docs/migration/artifacts/legacy-firebase/firestore.rules`.
