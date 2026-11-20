# Changelog

## 0.1.1 — 2026-11-20

* Fix: the magic link returns to the address where it was asked for (it went to the production
  address even when signing in elsewhere), and a link that lands on the home page also signs in.

## 0.1.0 — 2026-11-20

First pilot version.

* Sign-in by magic link or 6-digit code (Supabase Auth).
* End-to-end encryption with Web Crypto: device keys, diary key versions, key shares, recovery code
  (docs/security.md).
* Diaries with optional blocks (aggression, intensities, sleep, medication, events, strategies),
  mood −3…+3 and aggression 0…4 with qualifiers.
* Questions for the consultation; period summary with chart, numbers, print-to-PDF and CSV.
* Invites (writer / reader), device approval with fingerprints, removal with key rotation.
* Account page: devices, revoke, sign out, delete account. Light/dark theme.
