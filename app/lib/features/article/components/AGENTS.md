# Article Ingest Components Guide

- `AdminArticleIngestForm` is an admin-only queueing interface, not the article processor itself.
- Support ordered pasted/uploaded figures (up to the existing limits). They are supporting charts/graphs, never the hero image, and never OCR/model inputs.
- Keep the ingest form and status feedback localized through `app/lib/i18n/locales`.
