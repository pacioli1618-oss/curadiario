# Improvements (not in the pilot)

Ideas kept here until the roadmap says otherwise. Keep the app minimal.

* es and en translations (messages/*.json and locales.ts).
* SMTP for magic links (required before opening to other families; docs/deploy.md).
* Invite e-mails sent by the app (today the owner tells the person to sign in).
* "Desde a última consulta" as a summary period (needs a consultation date).
* Purge of accounts unused for a long time (pg_cron), with notice by e-mail.
* Real PDF file (today: the print dialog → "Salvar como PDF").
* Show the fingerprint of the approving person too (mutual verification).
