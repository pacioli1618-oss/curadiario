# Naming conventions

English is the base language of the codebase. Everything a developer reads or types is in English: identifiers, files, folders, routes, database objects, error codes, commits, code comments and developer docs. Only **user-facing text** is translated, and it lives in `messages/<locale>.json`, never in code.

## 1. Domain glossary

One concept, one word, everywhere: database, TypeScript, i18n keys and docs. When a pt-BR UI word has no listed term, add it here before using it.

| pt-BR (UI) | Code term | Examples |
| --- | --- | --- |
| Diário | `diary` | `curadiario.diaries`, `cd_create_diary`, `/d/[id]` |
| Ajustes do diário (nome, blocos, remédios) | `meta` | `DiaryMeta`, `cd_update_meta`, `meta_key_version` |
| Pessoa do diário | `member`; papéis `owner` / `writer` / `reader` | `curadiario.members`, `cd_remove_member` |
| Convite | `invite` | `cd_invite`, `cd_accept_invite` |
| Aparelho | `device` (`browser` or `recovery`) | `curadiario.devices`, `StoredDevice`, `device-keys.ts` |
| Chave do diário, versão da chave | `diary key`, `key version` | `DiaryKey`, `key_version`, `cd_rotate_key` |
| Cópia da chave para um aparelho | `key share` | `curadiario.key_shares`, `wrapDiaryKey()` |
| Aprovar aparelho | `approve` | `approveDevices()`, `PendingDevicesCard` |
| Código do aparelho | `fingerprint` | `fingerprint()` |
| Código de recuperação | `recovery code` | `generateRecoveryCode()`, `cd_get_recovery` |
| Entrada | `entry` | `EntryContent`, `cd_save_entry` |
| Pergunta para a consulta | `topic` | `TopicContent`, `cd_save_topic` |
| Bloco opcional | `block` | `BlockKey`, `blocks.sleep` |
| Humor | `mood` (−3…+3) | `Mood`, `moodValues` |
| Agressividade | `aggression` (0…4) | `AggressionLevel` |
| Quem relata | `reporter`: `observed` / `self` | `EntryContent.reporter` |
| Resumo do período | `summary` | `summarize()`, `SummaryTab` |

curadiário is a notebook, not care: no *diagnóstico*, *prontuário*, *tratamento* or *paciente* in code
or UI, except in the disclaimers that say so.

## 2. Abbreviations

Write words out in full: `quantity`, not `qty`; `event`, not `evt`; `medicine`, not `med`.

These are the only allowed abbreviations: `id`, `url`, `api`, `db`, `rsvp`, `i18n`, `ui`, `pwa`, `og` (Open Graph), plus the SQL prefixes in section 4.

## 3. TypeScript and React

| Thing | Style | Example |
| --- | --- | --- |
| React component file | `PascalCase.tsx` | `LocaleSwitcher.tsx`, `ItemCard.tsx` |
| Any other module | `kebab-case.ts` | `device-store.ts`, `use-loader.ts` |
| Component, type, interface | `PascalCase`, no `I` prefix | `WorkplaceFields`, `ClientWorkplace`, `StoredWorkplace` |
| Function, variable | `camelCase`, verb first for functions | `createWorkplace()`, `parseAmount()` |
| Hook | `useCamelCase`, file `use-kebab.ts` | `useLoader()` in `use-loader.ts` |
| Boolean | `is`, `has`, `can` or `should` prefix | `isLate`, `hasArrived` |
| Event handler | `handleX` inside, `onX` as a prop | `onRemove={handleRemove}` |
| Module-level constant | `SCREAMING_SNAKE_CASE` for fixed scalars | `STORAGE_KEY`, `DEBOUNCE_MS` |
| Readonly list of codes | `camelCase` plural, with a singular type | `unitCodes` / `UnitCode` |
| Next.js special files | the framework's names | `page.tsx`, `layout.tsx`, `proxy.ts` |
| Test file | `tests/<module>.test.ts` | `tests/crypto.test.ts`, `tests/diary.test.ts` |

**Database ↔ TypeScript boundary:** the database speaks `snake_case` and TypeScript speaks `camelCase`. The conversion happens only in `src/lib/api.ts`. Components never see `p_` parameters or snake_case fields.

## 4. Database (Postgres / Supabase)

| Thing | Style | Example |
| --- | --- | --- |
| Schema | app name | `curadiario` |
| Table | `snake_case`, plural noun | `diaries`, `key_shares`, `topics` |
| Column | `snake_case`, singular | `quantity_needed`, `plus_ones` |
| Primary key | `id uuid` | |
| Foreign key | `<singular table>_id` | `diary_id`, `device_id` |
| Timestamp | `<verb>_at` (`timestamptz`) | `created_at`, `revoked_at`, `rsvp_at` |
| Date-only, time-only | `<noun>_date`, `<noun>_time` | `exchange_date` |
| Boolean | `is_` / `has_`, or a past participle | `include_notes`, `wants_daily_notice` |
| Code-valued text | `text` + `check (... in (...))`, English codes | `kind in ('barbecue', ...)` |
| Public RPC | `cd_<verb>_<noun>` in `public` | `cd_create_diary`, `cd_share_keys`, `cd_get_diary` |
| Internal helper | `<verb>_<noun>` in `curadiario` | `require_role`, `require_device`, `insert_key_shares` |
| Function parameter | `p_` + `snake_case` | `p_slug`, `p_client_token` |
| PL/pgSQL local variable | `v_` + `snake_case` | `v_slug`, `v_others` |
| Trigger | `<table>_<action>` | `claims_notify` |
| Index | `<table>_<columns>_idx` | `members_user_id_idx` |
| Migration file | `<YYYYMMDDHHMMSS>_<snake_case_summary>.sql` | `20261108000300_naming_conventions.sql` |

Columns repeat the table name only when the bare word is a SQL type or keyword: `exchange_date`, not `date`.

**RPC verbs:** use `get`, `list`, `create`, `update`, `save` (create or update), `delete` (a row), `remove` (a person from a diary), `set` (replace a value), `share`, `rotate`, `revoke`, `invite`, `accept`, `decline`.

## 5. Error codes

Errors raised by RPCs carry a fixed English code as the message, in `snake_case`: `<subject>_<problem>` (`invite_not_found`, `device_not_found`) or a generic state (`not_authorized`, `stale_key_version`). The `Errors` namespace in `messages/*.json` uses the **same codes as keys**. This is the one place where i18n keys are `snake_case`.

## 6. Realtime

Not used. If added, it may only carry ids and timestamps: content stays encrypted.

## 7. Routes and URLs

Paths are short, lowercase, kebab-case English. They never include the locale (see `docs/i18n.md`). Secrets go in the URL fragment (`#…`) so they never reach the server or its logs.

| Route | Screen |
| --- | --- |
| `/` | Signed out: sign in by e-mail. Signed in: invites, my diaries, create one. |
| `/auth/callback` | Where the magic link lands (PKCE code exchange) |
| `/new` | Create a diary, then the recovery code |
| `/d/[id]` | One diary: entries (and the entry form), consultation questions, summary and export, people and settings |
| `/account` | My devices, revoke, sign out, delete account |
| `/version` | Version, commit and what changed |
| `/about`, `/privacy`, `/terms` | About, privacy policy, terms. Operator and contact in `src/lib/site.ts`. |

All pages are `noindex` during the pilot. Everything runs in the browser: the keys live there.

## 8. i18n messages

- **Namespaces** are `PascalCase`, one per screen or shared area: `Home`, `Diary`, `EntryForm`, `Common`.
- **Keys** are `camelCase`, named for meaning, not wording: `missingItems`, not `itensFaltando`.
- **Code-valued keys** match the stored code exactly: `Errors.invite_not_found`.
- `pt-BR` is the source file; `npm run i18n:check` enforces the rest.

## 9. CSS and design tokens

- **Tokens:** custom properties use the Design System token names, in `kebab-case` English: `--surface`, `--brand-strong`, `--ember`, `--radius-md`. They are all declared in `src/app/globals.css`, kept in sync with the Design System.
- **Styling:** CSS Modules, one `Component.module.css` next to `Component.tsx`. Class names are `camelCase` (`styles.fullWidth`).
- **Colors and sizes** come only from tokens (`var(--…)`). No hex values or magic radii inside components.
- **Borders, not shadows.**

## 10. Folders

| Folder | What goes there |
| --- | --- |
| `src/app/[locale]/` | Routes (pages, layouts). Page-only components sit next to their `page.tsx`. |
| `src/components/brand/` | Logo (the lantern) |
| `src/components/ui/` | Design System primitives with no domain knowledge: `Button`, `TextField`, `Toggle`, `Tag`, `Card` |
| `src/components/diary/`, `src/components/session/` | Components that know the domain: scales, chips, recovery code; sign-in and session |
| `src/hooks/` | React hooks shared across screens: `use-loader.ts`, `use-origin.ts` |
| `src/lib/` | Framework-free logic and the database door: `crypto.ts`, `vault.ts`, `api.ts`, `diary.ts`, `device-keys.ts`, `csv.ts` |
| `src/i18n/` | Locales, routing, error messages |

## 11. Environment variables

`SCREAMING_SNAKE_CASE`. The `NEXT_PUBLIC_` prefix only for values that are safe in the browser: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Server secrets have no prefix: `SUPABASE_SECRET_KEY`.

## 12. Git

- **Branches:** `<type>/<kebab-summary>`, as in `feat/period-summary` or `fix/recovery-code`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org) in English, imperative mood, as in `feat(summary): add the aggression days`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `db` (migrations), `i18n`.

## 13. Comments and docs

- **Code comments** are in English and explain *why*, not *what*.
- **Developer docs** (`README.md`, `docs/`) are in English.
- **Product and business documents** for the team, outside the repository, may stay in pt-BR.
