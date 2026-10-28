# Anam / Yeouido price parity — staged customer-facing copy

**Status:** Staged on a draft PR; do not merge or deploy before the payment price cutover.

## Planned new-customer prices

| Product | Anam old | Anam new (= Yeouido) | First-purchase referral discount | New referral price |
| --- | ---: | ---: | ---: | ---: |
| 30-day membership | ₩9,700 | ₩19,700 | ₩3,200 | ₩16,500 |
| 5-visit pass | ₩14,700 | ₩29,700 | ₩3,000 | ₩26,700 |

Do **not** modify existing members' `users.plan_price`, past `payment_orders`, pass credits, or purchased pass amounts.

## Customer-facing copy included in this PR

- Homepage KR/EN section headline focuses on quality rather than cheapness.
- Homepage KR/EN price comparison displays both regions and their different meetup lengths:
  - Anam: ₩19,700 / (4 × 2 hours) ≈ **₩2,463/hour**.
  - Yeouido: ₩19,700 / (4 × 1.5 hours) ≈ **₩3,283/hour**.
  - These are illustrative 4-attendance assumptions, not guaranteed attendance.
- Both human and machine/agent render modes are updated.
- Guide removes outdated claims about being cheaper than other meetups.
- Legacy homepage static ₩9,700 text is updated for future-proofing (this legacy component is not currently served under `/home`).
- Payment success UI no longer falls back to fabricated ₩4,700 if the transaction amount is missing.
- Korean marketing text templates no longer falsely advertise a Nov 2025 price increase or ₩4,700 membership.
- Actual KR/EN checkout cards, quote, subtotal and pay CTA currently fetch live `payment_products`; these must continue showing the real charge, and do not require hardcoded price updates.

## Publish sequence — coordinate price and copy changes

1. **Before cutover:** review this draft PR. Do NOT deploy new price-comparison figures while the new membership price is not yet charged. Do not edit `payment_products` yet.
2. **During the same cutover:** update only Anam `payment_products.list_amount`:
   - `membership_30d`, `anam`: `9700 → 19700`
   - `participation_pack_5`, `anam`: `14700 → 29700`
   - Do not change `referral_discount_amount`.
3. Merge/deploy the staged website copy in coordination with the DB change (minimize mixed prices, ensure current checkout remains accurate). Redeploy marketing edge function if its text is used.
4. **Only after cutover:** run `scripts/pricing/anam-yeouido-parity-blog-copy.sql` to refresh the published referral blog post. The SQL edits *content only* and is intentionally not an automatic migration.
5. Validate site in both KR and EN and both Anam/Yeouido selectors, including homepage chart, machine-mode markdown, product cards, quote/referral discounts, pay CTA and result screen. Confirm the actual checkout charge matches displayed price.
6. Validate an existing Anam subscriber retains original renewal price. Validate previously bought 5-visit passes retain their credit balances and amount-based refund history.

## Historical content

There are 78 *past* meetup descriptions with historic low-price claims. These are historical records; all upcoming/current meetup descriptions were checked and none displayed those claims. Consider leaving past-event records untouched or adding an archive notice separately rather than rewriting event history.

## Rollback

If the DB update does not complete, do not deploy the new hourly comparison. If the website deploy fails, checkout still reads database values, but promptly reconcile all marketing displays. Never roll back existing members' `plan_price`.
