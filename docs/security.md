# Security model

curadiário keeps family health notes. The goal: **the operator (GR1618), Supabase, Vercel and
anyone who copies the database cannot read the content**. Only devices that the people of a diary
approved can.

## Keys

| Key | Where it lives | What it does |
| --- | --- | --- |
| Device key pair (ECDH P-256) | IndexedDB of each browser; private key created **non-extractable** | Receives diary keys |
| Diary key (AES-256-GCM), one per *key version* | Only in memory, after being opened | Encrypts meta, entries and questions |
| Key share | `curadiario.key_shares` | A diary key version encrypted for one device: ephemeral ECDH + HKDF-SHA256 → AES-GCM |
| Recovery key pair (ECDH P-256), one per diary | Public key and **encrypted** private key in `curadiario.devices` (`kind = 'recovery'`) | Lets the owner recover with the code |
| Recovery code | Only with the owner (paper, password manager) | 24 Crockford base32 characters = 120 random bits; HKDF-SHA256 → AES-GCM over the recovery private key |

All of it uses the browser's Web Crypto (`src/lib/crypto.ts`); there is no crypto library.

## Encrypted data

Every blob is `{iv, ct}` with AES-GCM and **associated data** that names what it is
(`curadiario/v1/entry/<diary>/<entry>`, `…/meta/<diary>/<version>`, `…/share/<diary>/<version>`).
The server can't swap a blob between diaries, entries or versions without the decryption failing.

Encrypted: diary name, blocks and medicines (meta); each entry (all fields); each question.
Not encrypted (the server needs it or sees it anyway): e-mail, membership and role, display names,
device labels ("Chrome · Android"), timestamps and sizes.

## Flows

* **Create**: the browser makes diary key v1, shares it with its own device and with a new recovery
  key pair locked by a fresh recovery code (`cd_create_diary`). The code is shown once.
* **New device or new member**: the device registers its public key (`cd_register_device`) and
  waits. An owner or writer sees it under "Aparelhos esperando aprovação" with a fingerprint
  (first 6 bytes of SHA-256 over the public key) and approves; their browser wraps every key
  version for it (`cd_share_keys`). People should compare the fingerprint on both screens: that is
  what stops a dishonest server from slipping in its own device.
* **Removal**: `cd_remove_member` / `cd_revoke_device` delete the shares and set
  `needs_rotation`. The owner's browser then makes the next key version and shares it only with
  devices that already read the current one, plus the recovery key (`cd_rotate_key`). Older
  entries stay under their old version: whoever left could already read them.
* **Recovery** (owner): the code opens the recovery private key, which opens every key version,
  which is then shared with the current device.

## What this does not protect against

* A device that is approved and unlocked (someone with the phone in hand).
* A dishonest server that also gets someone to approve its device without comparing fingerprints.
* Metadata: who belongs to which diary, and when they write.
* A modified app: the code served by Vercel could be changed to leak keys. The code is open
  (AGPL) so this can be audited, but each visit trusts the deployed version.
* Losing every approved device **and** the recovery code: nothing can be recovered, by design.
