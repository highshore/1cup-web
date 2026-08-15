# Admin Portal Guide

- `/admin` is the overview/router. Keep members, articles, and marketing on `/admin/members`, `/admin/articles`, and `/admin/marketing`; feedback is rendered with members.
- The article admin route owns the article-ingest form and processing list. Preserve its localized status labels and the visible processing progress contract.
- Do not move article processing into the browser. The form only queues the authenticated admin callable; Cloud Functions perform all source processing.
