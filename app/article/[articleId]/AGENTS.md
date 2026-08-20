# Article Page Guide

- Keep article interactions in `ArticleClient.tsx` and localize new visible labels under `app/lib/i18n/locales`.
- Guests are currently limited to two article paragraphs in the client; signed-in users see the full article. Do not change this access model without explicit product approval.
- The Quick Summary defaults to the English generated summary. Korean appears only after the user presses its language button.
- Revealing Korean from either the Quick Summary or an article paragraph counts toward the translation-warning threshold. Keep paragraph copy actions in their local row, while header copy actions right-align on mobile.
- Inline figures are caption-free, round-cornered visual breaks. Preserve consistent compact action-button heights and avoid asymmetric colored left borders on article cards.
- Discussion topics listen to public Supabase aggregate scores and reorder by net score. Do not write vote totals from the client; call the `discussion-vote` Edge Function and treat active subscriptions as the voting entitlement. Legacy topics without IDs use `topic-{originalIndex}`.
