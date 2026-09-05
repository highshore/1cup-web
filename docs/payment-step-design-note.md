# Payment checkout sequence

The regional checkout intentionally follows the legacy compact visual system and reveals information progressively:

1. Choose location (Anam or Yeouido). No price is shown yet.
2. Choose 30-day membership or 5-use participation pack. Product buttons do not reveal prices.
3. Only after both choices are made, show the server-provided regional price, optional first-purchase referral field, benefits, the scenario-specific full payment/refund disclaimer, and the payment CTA.

The `resume=1` query flag is used only when returning from authentication so a user who already made steps 1 and 2 does not have to repeat them. Ordinary links with `region` or `product` parameters do not skip the required selection sequence.
