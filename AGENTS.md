<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## curadiário project rules

- **Nothing readable leaves the browser.** Diary content (meta, entries, questions) is encrypted in `src/lib/vault.ts` before any RPC. Never send a diary key, a private key or plaintext content to the server, logs or analytics. Read `docs/security.md` before touching keys.
- Follow `docs/conventions.md`: English for every identifier, file, route, database object, error code, commit, comment and developer doc. One concept, one word (glossary in section 1).
- User-facing text only through `messages/pt-BR.json` (`docs/i18n.md`). Run `npm run i18n:check` after editing messages.
- Database access only through the `public.cd_*` RPCs, wrapped in `src/lib/api.ts`. Schema changes go in a new migration in `supabase/migrations/`; never edit an applied migration.
- Encrypted shapes (`DiaryMeta`, `EntryContent`, `TopicContent` in `src/lib/diary.ts`) carry `v`. Old versions must keep opening: convert them in the `read*` functions.
- curadiário is a notebook, not care: never present scales as diagnosis, and keep the crisis notice (188 / 192) wherever someone writes.
- Keep the app minimal. Items in `docs/improvements.md` are not built until the roadmap says so.
- Bump `package.json` version, `CHANGELOG.md` and `Version.releases` in `messages/pt-BR.json` together.
- Before finishing: `npm run lint`, `npm run typecheck`, `npm run i18n:check`, `npm test`, `npm run build`.
