# Admin Portal Guide

- `/admin` is the overview/router. Keep members, articles, and marketing on `/admin/members`, `/admin/articles`, and `/admin/marketing`; feedback is rendered with members.
- The article admin route owns the article-ingest form and processing list. Preserve its localized status labels and the visible processing progress contract.
- Do not move article processing into the browser. The form only queues the authenticated admin callable; Cloud Functions perform all source processing.
- Marketing begins at `/admin/marketing`. It is the Gopas cron workspace: the original Gopas ad is seeded as a template, an editable template selector sits above the post fields, changed content (including ordered photos) is saved via a new-name dialog, and one saved template is assigned to each scheduled KST weekday. No selected days disables automatic posting. The run cards show each scheduled or manual execution, including duplicate-ad skips. Do not restore the removed channel-specific A/B route.
