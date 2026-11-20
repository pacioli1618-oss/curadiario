// End-to-end encryption with the browser's own Web Crypto. No library, nothing leaves the device
// in the clear. Full design: docs/security.md.
//
//   device key pair   ECDH P-256. The private key is created non-extractable and stays in IndexedDB.
//   diary key         32 random bytes per key version, used as AES-256-GCM.
//   key share         a diary key encrypted for one device: ephemeral ECDH + HKDF-SHA256 → AES-GCM.
//   recovery          a key pair per diary whose private key is encrypted with the recovery code.
//   blob              {iv, ct}: AES-GCM with associated data that binds it to its diary and id,
//                     so the server can't move a blob from one place to another.
//
// Works in browsers and in Node 20+ (tests), both expose globalThis.crypto.subtle.

const subtle = () => globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

// ---------------------------------------------------------------------------
// Types stored on the server
// ---------------------------------------------------------------------------

export type PublicJwk = {kty: 'EC'; crv: 'P-256'; x: string; y: string};

/** Encrypted content: AES-256-GCM, base64. */
export type Sealed = {iv: string; ct: string};

/** A diary key version encrypted for one device's public key. */
export type WrappedKey = {v: 1; epk: PublicJwk; salt: string; iv: string; ct: string};

/** The recovery private key (PKCS#8) encrypted with a key derived from the recovery code. */
export type EncryptedPrivateKey = {v: 1; salt: string; iv: string; ct: string};

// ---------------------------------------------------------------------------
// Associated data: what each blob belongs to
// ---------------------------------------------------------------------------

export const context = {
  share: (diaryId: string, keyVersion: number) => `curadiario/v1/share/${diaryId}/${keyVersion}`,
  meta: (diaryId: string, keyVersion: number) => `curadiario/v1/meta/${diaryId}/${keyVersion}`,
  entry: (diaryId: string, entryId: string) => `curadiario/v1/entry/${diaryId}/${entryId}`,
  topic: (diaryId: string, topicId: string) => `curadiario/v1/topic/${diaryId}/${topicId}`,
  recovery: () => 'curadiario/v1/recovery',
};

// ---------------------------------------------------------------------------
// Device key pairs
// ---------------------------------------------------------------------------

const ECDH = {name: 'ECDH', namedCurve: 'P-256'} as const;

/** A new device key pair. The private key can never be exported, not even by this app. */
export async function generateDeviceKeyPair(): Promise<CryptoKeyPair> {
  return subtle().generateKey(ECDH, false, ['deriveBits']) as Promise<CryptoKeyPair>;
}

export async function exportPublicJwk(publicKey: CryptoKey): Promise<PublicJwk> {
  const jwk = await subtle().exportKey('jwk', publicKey);
  return {kty: 'EC', crv: 'P-256', x: jwk.x as string, y: jwk.y as string};
}

async function importPublicJwk(jwk: PublicJwk): Promise<CryptoKey> {
  return subtle().importKey('jwk', {kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true}, ECDH, true, []);
}

/** Short fingerprint of a public key, to compare on two screens: "4F2A · 91C0 · 7B3E". */
export async function fingerprint(jwk: PublicJwk): Promise<string> {
  const digest = new Uint8Array(await subtle().digest('SHA-256', encoder.encode(`${jwk.x}.${jwk.y}`)));
  const hex = Array.from(digest.slice(0, 6), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${hex.slice(0, 4)} · ${hex.slice(4, 8)} · ${hex.slice(8, 12)}`;
}

// ---------------------------------------------------------------------------
// AES-GCM
// ---------------------------------------------------------------------------

async function deriveAesKey(secret: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>, info: string): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    {name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(info)},
    base,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt'],
  );
}

async function aesEncrypt(key: CryptoKey, plain: Uint8Array<ArrayBuffer>, aad: string): Promise<Sealed> {
  const iv = randomBytes(12);
  const ct = await subtle().encrypt({name: 'AES-GCM', iv, additionalData: encoder.encode(aad)}, key, plain);
  return {iv: toBase64(iv), ct: toBase64(new Uint8Array(ct))};
}

async function aesDecrypt(key: CryptoKey, blob: Sealed, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  const plain = await subtle().decrypt(
    {name: 'AES-GCM', iv: fromBase64(blob.iv), additionalData: encoder.encode(aad)},
    key,
    fromBase64(blob.ct),
  );
  return new Uint8Array(plain);
}

// ---------------------------------------------------------------------------
// Diary keys
// ---------------------------------------------------------------------------

/** A diary key version as kept in memory: the raw bytes (to share it) and the AES key (to use it). */
export type DiaryKey = {version: number; raw: Uint8Array<ArrayBuffer>; key: CryptoKey};

export async function importDiaryKey(version: number, raw: Uint8Array<ArrayBuffer>): Promise<DiaryKey> {
  if (raw.length !== 32) throw new Error('invalid_key');
  const key = await subtle().importKey('raw', raw, {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']);
  return {version, raw, key};
}

export async function generateDiaryKey(version: number): Promise<DiaryKey> {
  return importDiaryKey(version, randomBytes(32));
}

/** Encrypts a diary key version for one device. Anyone with the public key can do this. */
export async function wrapDiaryKey(diaryKey: DiaryKey, recipient: PublicJwk, diaryId: string): Promise<WrappedKey> {
  const ephemeral = (await subtle().generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair;
  const shared = new Uint8Array(
    await subtle().deriveBits({name: 'ECDH', public: await importPublicJwk(recipient)}, ephemeral.privateKey, 256),
  );
  const salt = randomBytes(16);
  const info = context.share(diaryId, diaryKey.version);
  const blob = await aesEncrypt(await deriveAesKey(shared, salt, info), diaryKey.raw, info);
  return {v: 1, epk: await exportPublicJwk(ephemeral.publicKey), salt: toBase64(salt), ...blob};
}

/** Opens a key share with this device's (or the recovery) private key. */
export async function unwrapDiaryKey(
  wrapped: WrappedKey,
  privateKey: CryptoKey,
  diaryId: string,
  version: number,
): Promise<DiaryKey> {
  const shared = new Uint8Array(
    await subtle().deriveBits({name: 'ECDH', public: await importPublicJwk(wrapped.epk)}, privateKey, 256),
  );
  const info = context.share(diaryId, version);
  const raw = await aesDecrypt(await deriveAesKey(shared, fromBase64(wrapped.salt), info), wrapped, info);
  return importDiaryKey(version, raw);
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export async function encryptJson(diaryKey: DiaryKey, value: unknown, aad: string): Promise<Sealed> {
  return aesEncrypt(diaryKey.key, encoder.encode(JSON.stringify(value)), aad);
}

export async function decryptJson<T>(diaryKey: DiaryKey, blob: Sealed, aad: string): Promise<T> {
  return JSON.parse(decoder.decode(await aesDecrypt(diaryKey.key, blob, aad))) as T;
}

// ---------------------------------------------------------------------------
// Recovery code
// ---------------------------------------------------------------------------

// Crockford's base32: no I, L, O or U, so the code survives being copied by hand.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const RECOVERY_CODE_LENGTH = 24; // 24 × 5 bits = 120 bits

/** "K7QF-29XM-HT4C-8RWN-P3LD-6YVB". */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(RECOVERY_CODE_LENGTH);
  let code = '';
  for (const byte of bytes) code += ALPHABET[byte & 31];
  return formatRecoveryCode(code);
}

/** Uppercase, no separators, and the usual look-alikes fixed (O→0, I/L→1). Null if not a code. */
export function normalizeRecoveryCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[\s\-_.]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (code.length !== RECOVERY_CODE_LENGTH || [...code].some((char) => !ALPHABET.includes(char))) return null;
  return code;
}

export function formatRecoveryCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? []).join('-');
}

async function recoveryKey(code: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) throw new Error('invalid_recovery_code');
  // The code is 120 random bits, so a fast KDF is enough: there is nothing to guess.
  return deriveAesKey(encoder.encode(normalized), salt, context.recovery());
}

/** A new recovery key pair, its private key locked with the code. */
export async function createRecovery(code: string): Promise<{publicKey: PublicJwk; encryptedPrivateKey: EncryptedPrivateKey}> {
  const pair = (await subtle().generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey));
  const salt = randomBytes(16);
  const blob = await aesEncrypt(await recoveryKey(code, salt), pkcs8, context.recovery());
  pkcs8.fill(0);
  return {publicKey: await exportPublicJwk(pair.publicKey), encryptedPrivateKey: {v: 1, salt: toBase64(salt), ...blob}};
}

/** Opens the recovery private key with the code. Throws 'invalid_recovery_code' when it doesn't fit. */
export async function openRecovery(code: string, encrypted: EncryptedPrivateKey): Promise<CryptoKey> {
  let pkcs8: Uint8Array<ArrayBuffer>;
  try {
    pkcs8 = await aesDecrypt(await recoveryKey(code, fromBase64(encrypted.salt)), encrypted, context.recovery());
  } catch {
    throw new Error('invalid_recovery_code');
  }
  return subtle().importKey('pkcs8', pkcs8, ECDH, false, ['deriveBits']);
}
