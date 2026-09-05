# Payment step UI test scenarios

1. Fresh visit to `/payment`: only the compact card header and location choices are shown. No regional price appears.
2. Select Anam: product choices appear, but no price appears yet.
3. Select 30-day membership: show 9,700 KRW, referral input, membership benefits, full membership disclaimer and CTA.
4. Select Yeouido then 30-day membership: show 19,700 KRW.
5. Select Anam then 5-use pack: show 14,700 KRW and the pack-specific disclaimer/refund formula.
6. Select Yeouido then 5-use pack: show 29,700 KRW.
7. Change location after choosing a product: product selection resets, so price/details disappear until the user chooses a product again.
8. Apply a valid first-purchase referral after both selections: the displayed amount updates to the server quote and the scenario disclaimer remains visible.
9. Existing active subscriber: 30-day membership is disabled, grandfathering message is shown, and 5-use pack remains selectable.
10. Logged-out payment/referral attempt: auth redirect uses `resume=1`; after login, the already-completed location/product selection is restored.
