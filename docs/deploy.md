# Deploy

Production runs on **Vercel** (Next.js, no Vercel-specific code) with the **SideKick Supabase
project** (sa-east-1, shared with the other Sidekicks), in its own `curadiario` schema.

## 1. Database

Apply the files in `supabase/migrations/` in order (Supabase → SQL editor, or `supabase db push`).
They only create the `curadiario` schema and the `public.cd_*` functions; they do not touch the
other apps' schemas. The security advisor flags "authenticated can execute security definer
function" on the `cd_*` functions: expected, that is the API.

## 2. Supabase Auth (once)

curadiário is the only Sidekick with sign-in, so Auth settings in the SideKick project are its own.

1. Authentication → URL Configuration:
   * Site URL: `https://curadiario.gr1618.io`
   * Redirect URLs: add `https://curadiario.gr1618.io/auth/callback`,
     `https://curadiario-*.vercel.app/auth/callback` (Vercel addresses and previews) and, for local
     work, `http://localhost:3000/auth/callback`.

   The link always returns to the address where the person asked for it: the sign-in only finishes
   in that same browser and address. A redirect Supabase doesn't accept falls back to the Site URL.
2. Authentication → Sign In / Providers → Email: enabled, "Confirm email" on.
3. Authentication → Emails → "Magic Link" template: include the 6-digit code, for when the link
   opens in another browser (the app accepts either):

   ```html
   <h2>Entrar no curadiário</h2>
   <p><a href="{{ .ConfirmationURL }}">Entrar</a></p>
   <p>Ou digite este código no app: <strong>{{ .Token }}</strong></p>
   <p>Se não foi você, ignore este e-mail.</p>
   ```

   Do the same in the "Confirm signup" template (first sign-in of a new e-mail).
4. **E-mail sending.** Without custom SMTP, Supabase only delivers to members of the project's
   team and caps sending at a few e-mails per hour. Fine for the first tests; before inviting
   other families, set up SMTP (Resend or Brevo) under Authentication → Emails → SMTP Settings,
   sending as e.g. `nao-responda@gr1618.io` (DNS records at Hover).

## 3. Vercel project

1. Import `pacioli1618-oss/curadiario` in Vercel (framework preset: Next.js, default build and output).
2. Environment variables (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://uqkyhzvdwynpkqdiuvyn.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key (`.env.example`) |
   | `NEXT_PUBLIC_SITE_URL` | `https://curadiario.gr1618.io` |

   Both Supabase values are public by design: the RPCs require a signed-in user, and the
   content they return is encrypted.
3. Function region: **São Paulo (gru1)**, next to the database (`vercel.json`).

## 4. Domain

1. Vercel → Project → Settings → Domains → add `curadiario.gr1618.io`.
2. At Hover, add the `CNAME` record Vercel shows (name `curadiario`).
3. Wait for Vercel to mark the domain valid; HTTPS is automatic.

## 5. Smoke test after each deploy

Two browsers (A and B), two e-mail addresses that receive mail (team members while there is no SMTP).

1. A: sign in by e-mail, create a diary, save the recovery code, write an entry with mood and
   aggression.
2. A → People: invite B's e-mail as "só lê".
3. B: sign in, accept the invite. The diary shows "aguardando liberação".
4. A → People: the new device appears with a code; compare it with B's screen; approve.
5. B: opens the diary and reads the entry. B has no "Nova entrada" button.
6. A: Resumo → Gerar PDF and Baixar planilha (accents and columns right in Excel).
7. A: remove B. Reload: the diary moves to key version 2 (`curadiario.diaries.key_version`);
   B's home no longer lists it.
8. A, in a private window: sign in, open the diary (locked), recover with the code.
9. Footer shows `versão 0.1.0 · <commit>`; `/version` lists the release.
