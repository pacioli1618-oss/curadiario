import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  context,
  createRecovery,
  decryptJson,
  encryptJson,
  exportPublicJwk,
  fingerprint,
  formatRecoveryCode,
  generateDeviceKeyPair,
  generateDiaryKey,
  generateRecoveryCode,
  normalizeRecoveryCode,
  openRecovery,
  unwrapDiaryKey,
  wrapDiaryKey,
} from '../src/lib/crypto';

const diaryId = '11111111-1111-4111-8111-111111111111';

test('a diary key shared with a device opens only on that device', async () => {
  const ana = await generateDeviceKeyPair();
  const marcos = await generateDeviceKeyPair();
  const key = await generateDiaryKey(1);
  const wrapped = await wrapDiaryKey(key, await exportPublicJwk(ana.publicKey), diaryId);

  const opened = await unwrapDiaryKey(wrapped, ana.privateKey, diaryId, 1);
  assert.deepEqual(opened.raw, key.raw);
  await assert.rejects(unwrapDiaryKey(wrapped, marcos.privateKey, diaryId, 1));
  // Bound to its diary and version: the server can't pass it off as another.
  await assert.rejects(unwrapDiaryKey(wrapped, ana.privateKey, '22222222-2222-4222-8222-222222222222', 1));
  await assert.rejects(unwrapDiaryKey(wrapped, ana.privateKey, diaryId, 2));
});

test('device private keys cannot be exported', async () => {
  const pair = await generateDeviceKeyPair();
  assert.equal(pair.privateKey.extractable, false);
  await assert.rejects(globalThis.crypto.subtle.exportKey('pkcs8', pair.privateKey));
});

test('content round-trips and is bound to its place', async () => {
  const key = await generateDiaryKey(1);
  const entry = {v: 1, mood: -2, note: 'Ficou agitado no fim da tarde. Ação: volta no quarteirão.'};
  const sealed = await encryptJson(key, entry, context.entry(diaryId, 'e1'));
  assert.ok(!sealed.ct.includes('agitado'));
  assert.deepEqual(await decryptJson(key, sealed, context.entry(diaryId, 'e1')), entry);
  await assert.rejects(decryptJson(key, sealed, context.entry(diaryId, 'e2')));
  const other = await generateDiaryKey(1);
  await assert.rejects(decryptJson(other, sealed, context.entry(diaryId, 'e1')));
});

test('recovery code opens the recovery key, and only the right code does', async () => {
  const code = generateRecoveryCode();
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){5}$/);
  const recovery = await createRecovery(code);
  const key = await generateDiaryKey(3);
  const wrapped = await wrapDiaryKey(key, recovery.publicKey, diaryId);

  // Typed by hand: lower case, spaces, O for 0.
  const typed = code.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o');
  const privateKey = await openRecovery(typed, recovery.encryptedPrivateKey);
  assert.deepEqual((await unwrapDiaryKey(wrapped, privateKey, diaryId, 3)).raw, key.raw);

  const wrong = generateRecoveryCode();
  await assert.rejects(openRecovery(wrong, recovery.encryptedPrivateKey), /invalid_recovery_code/);
});

test('recovery code normalization', () => {
  assert.equal(normalizeRecoveryCode('abc'), null);
  const code = 'K7QF29XMHT4C8RWNP3MD6YVB';
  assert.equal(normalizeRecoveryCode('k7qf-29xm-ht4c 8rwn-p3md-6yvb'), code);
  assert.equal(normalizeRecoveryCode('K7QF-29XM-HT4C-8RWN-P3MD-6YVU'), null); // U is not in the alphabet
  assert.equal(formatRecoveryCode(code), 'K7QF-29XM-HT4C-8RWN-P3MD-6YVB');
});

test('fingerprints are stable and short', async () => {
  const pair = await generateDeviceKeyPair();
  const jwk = await exportPublicJwk(pair.publicKey);
  assert.equal(await fingerprint(jwk), await fingerprint({...jwk}));
  assert.match(await fingerprint(jwk), /^[0-9A-F]{4} · [0-9A-F]{4} · [0-9A-F]{4}$/);
});
