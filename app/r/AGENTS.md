# Growth Redirect Guide

- `/r/[trackingCode]` is a public first-party attribution redirect. Resolve only known `growth_posts` records, increment clicks server-side, and preserve the tracking code through query parameters and the 30-day cookie.
- Keep the redirect resilient: a bad or expired code must still land on the 1Cup English homepage without exposing internal errors.
