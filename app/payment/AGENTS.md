# Payment Attribution Guide

- Payment processing is high-risk. Do not alter the Payple contract while handling marketing attribution.
- Read a growth code only from the landing query or first-party cookie, send it as an optional field, and let the Cloud Function validate and attribute it. Never update marketing metrics from the payment browser client.
