// Diary keys at work: opening them on this device, sharing them with approved devices, creating
// the next version, and recovery. Everything that needs a diary key in the clear lives here and
// stays in this tab's memory.

import * as api from './api';
import {
  context,
  createRecovery,
  decryptJson,
  encryptJson,
  generateDiaryKey,
  generateRecoveryCode,
  openRecovery,
  unwrapDiaryKey,
  wrapDiaryKey,
  type DiaryKey,
  type Sealed,
} from './crypto';
import {readEntry, readMeta, readTopic, type DatedEntry, type DiaryMeta, type EntryContent, type TopicContent} from './diary';
import type {StoredDevice} from './device-keys';

export type KeyRing = Map<number, DiaryKey>;

/** Opens every key version this device has a share for. Shares that don't open are skipped. */
export async function openKeyRing(diaryId: string, shares: api.DiaryDetails['shares'], privateKey: CryptoKey): Promise<KeyRing> {
  const ring: KeyRing = new Map();
  for (const share of shares) {
    try {
      ring.set(share.keyVersion, await unwrapDiaryKey(share.wrapped, privateKey, diaryId, share.keyVersion));
    } catch {
      // A share this device can't open (tampered, or for another key): ignore it.
    }
  }
  return ring;
}

export async function openMeta(diaryId: string, meta: Sealed, version: number, ring: KeyRing): Promise<DiaryMeta | null> {
  const key = ring.get(version);
  if (!key) return null;
  try {
    return readMeta(await decryptJson(key, meta, context.meta(diaryId, version)));
  } catch {
    return null;
  }
}

/** For the diary list: opens the name with the single share the list carries. */
export async function openListedMeta(row: api.DiarySummaryRow, privateKey: CryptoKey): Promise<DiaryMeta | null> {
  if (!row.share) return null;
  try {
    const key = await unwrapDiaryKey(row.share, privateKey, row.id, row.metaKeyVersion);
    return readMeta(await decryptJson(key, row.meta, context.meta(row.id, row.metaKeyVersion)));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Creating a diary
// ---------------------------------------------------------------------------

export async function createDiary(input: {
  device: StoredDevice;
  displayName: string;
  meta: DiaryMeta;
  termsVersion: string;
}): Promise<{diaryId: string; recoveryCode: string}> {
  const diaryId = crypto.randomUUID();
  const key = await generateDiaryKey(1);
  const recoveryCode = generateRecoveryCode();
  const recovery = await createRecovery(recoveryCode);
  await api.createDiary({
    diaryId,
    meta: await encryptJson(key, input.meta, context.meta(diaryId, 1)),
    displayName: input.displayName,
    termsVersion: input.termsVersion,
    deviceId: input.device.deviceId,
    deviceShare: await wrapDiaryKey(key, input.device.publicJwk, diaryId),
    recoveryPublicKey: recovery.publicKey,
    recoveryPrivate: recovery.encryptedPrivateKey,
    recoveryShare: await wrapDiaryKey(key, recovery.publicKey, diaryId),
  });
  return {diaryId, recoveryCode};
}

export async function saveMeta(diaryId: string, ring: KeyRing, currentVersion: number, meta: DiaryMeta) {
  const key = requireKey(ring, currentVersion);
  await api.updateMeta(diaryId, await encryptJson(key, meta, context.meta(diaryId, currentVersion)), currentVersion);
}

// ---------------------------------------------------------------------------
// Sharing keys
// ---------------------------------------------------------------------------

/** Gives approved devices every key version this device holds. */
export async function approveDevices(diaryId: string, ring: KeyRing, devices: api.PendingDevice[]) {
  const shares: api.ShareInput[] = [];
  for (const device of devices) {
    for (const key of ring.values()) {
      shares.push({deviceId: device.deviceId, keyVersion: key.version, wrapped: await wrapDiaryKey(key, device.publicKey, diaryId)});
    }
  }
  if (shares.length) await api.shareKeys(diaryId, shares);
}

/**
 * The next key version, after someone left or a device was revoked (owner only). Only devices that
 * already read the current version get it, plus the recovery device; devices still waiting for
 * approval receive every version when approved.
 */
export async function rotateKey(details: api.DiaryDetails, ring: KeyRing, meta: DiaryMeta): Promise<DiaryKey> {
  const nextVersion = details.keyVersion + 1;
  const next = await generateDiaryKey(nextVersion);
  const waiting = new Set(details.pendingDevices.map((device) => device.deviceId));
  const shares: api.ShareInput[] = [];
  for (const target of details.shareTargets) {
    if (waiting.has(target.deviceId)) continue;
    shares.push({deviceId: target.deviceId, keyVersion: nextVersion, wrapped: await wrapDiaryKey(next, target.publicKey, details.id)});
  }
  await api.rotateKey(details.id, nextVersion, await encryptJson(next, meta, context.meta(details.id, nextVersion)), shares);
  ring.set(nextVersion, next);
  return next;
}

/**
 * Recovery (owner): the code opens the recovery key, which opens every version, which this device
 * then receives. Throws 'invalid_recovery_code' when the code doesn't fit.
 */
export async function recoverWithCode(diaryId: string, code: string, device: StoredDevice) {
  const bundle = await api.getRecovery(diaryId);
  const privateKey = await openRecovery(code, bundle.encryptedPrivateKey);
  const ring = await openKeyRing(diaryId, bundle.shares, privateKey);
  if (!ring.size) throw new Error('invalid_recovery_code');
  await approveDevices(diaryId, ring, [
    {deviceId: device.deviceId, userId: device.userId, displayName: '', label: '', publicKey: device.publicJwk, createdAt: device.createdAt},
  ]);
}

// ---------------------------------------------------------------------------
// Entries and topics
// ---------------------------------------------------------------------------

function requireKey(ring: KeyRing, version: number): DiaryKey {
  const key = ring.get(version);
  if (!key) throw new Error('key_missing');
  return key;
}

export async function sealEntry(diaryId: string, ring: KeyRing, version: number, entryId: string, content: EntryContent) {
  return encryptJson(requireKey(ring, version), content, context.entry(diaryId, entryId));
}

export async function sealTopic(diaryId: string, ring: KeyRing, version: number, topicId: string, content: TopicContent) {
  return encryptJson(requireKey(ring, version), content, context.topic(diaryId, topicId));
}

/** Decrypts what this device can. Records it can't open are counted, not shown. */
export async function openEntries(diaryId: string, ring: KeyRing, records: api.SealedRecord[]) {
  const entries: DatedEntry[] = [];
  let unreadable = 0;
  for (const record of records) {
    const key = ring.get(record.keyVersion);
    try {
      if (!key) throw new Error('key_missing');
      const content = readEntry(await decryptJson(key, record.payload, context.entry(diaryId, record.id)));
      if (!content) throw new Error('invalid_entry');
      entries.push({id: record.id, authorId: record.authorId, createdAt: record.createdAt, content});
    } catch {
      unreadable++;
    }
  }
  entries.sort((a, b) => b.content.writtenAt.localeCompare(a.content.writtenAt));
  return {entries, unreadable};
}

export type OpenTopic = {id: string; authorId: string | null; createdAt: string; content: TopicContent};

export async function openTopics(diaryId: string, ring: KeyRing, records: api.SealedRecord[]): Promise<OpenTopic[]> {
  const topics: OpenTopic[] = [];
  for (const record of records) {
    const key = ring.get(record.keyVersion);
    if (!key) continue;
    try {
      const content = readTopic(await decryptJson(key, record.payload, context.topic(diaryId, record.id)));
      if (content) topics.push({id: record.id, authorId: record.authorId, createdAt: record.createdAt, content});
    } catch {
      // skip
    }
  }
  return topics;
}
