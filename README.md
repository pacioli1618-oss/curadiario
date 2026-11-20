# curadiário

A care diary for families: whoever looks after someone writes down how the day went (mood,
aggression, sleep, medicines, events) and shares it only with trusted people. Everything is
encrypted on the device before it reaches the server; not even the operator can read it.

An experiment in the GR1618 Labs Sidekick series. Pilot at https://curadiario.gr1618.io.

## Stack

* Next.js 16 (App Router) + next-intl. Everything runs in the browser, where the keys live.
* Supabase: Auth by magic link, and `public.cd_*` RPCs over the `curadiario` schema.
* Web Crypto: ECDH P-256, HKDF-SHA256, AES-256-GCM. Model in `docs/security.md`.

## Run locally

```bash
cp .env.example .env.local   # point NEXT_PUBLIC_SITE_URL at http://localhost:3000
npm install
npm run dev
```

The magic link needs `http://localhost:3000/auth/callback` in Supabase's Redirect URLs
(`docs/deploy.md`).

## Check

```bash
npm run lint && npm run typecheck && npm run i18n:check && npm test && npm run build
```

## Docs

* `docs/security.md` — keys, flows and limits of the encryption.
* `docs/deploy.md` — database, Auth, Vercel, domain and the smoke test after each deploy.
* `docs/conventions.md` — names, glossary, database.
* `docs/i18n.md` — user-facing text.

## License

AGPL-3.0-only. Inter and Manrope fonts under the SIL OFL 1.1 (`src/app/fonts/OFL.txt`).
