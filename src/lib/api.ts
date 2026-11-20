// Every call to the server: the public.cd_* RPCs (supabase/migrations). snake_case stays here;
// the rest of the app sees camelCase. Encrypted fields pass through untouched.

import type {EncryptedPrivateKey, PublicJwk, Sealed, WrappedKey} from './crypto';
import {supabase} from './supabase';

export type Role = 'owner' | 'writer' | 'reader';

async function call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export const registerDevice = (publicKey: PublicJwk, label: string) =>
  call<string>('cd_register_device', {p_public_key: publicKey, p_label: label});

export type DeviceInfo = {id: string; label: string; createdAt: string; lastSeenAt: string};

export async function listDevices(deviceId: string): Promise<DeviceInfo[]> {
  const rows = await call<{id: string; label: string; created_at: string; last_seen_at: string}[]>('cd_list_devices', {p_device_id: deviceId});
  return rows.map((row) => ({id: row.id, label: row.label, createdAt: row.created_at, lastSeenAt: row.last_seen_at}));
}

export const revokeDevice = (deviceId: string) => call<void>('cd_revoke_device', {p_device_id: deviceId});

// ---------------------------------------------------------------------------
// Diaries
// ---------------------------------------------------------------------------

export type DiarySummaryRow = {
  id: string;
  role: Role;
  keyVersion: number;
  meta: Sealed;
  metaKeyVersion: number;
  share: WrappedKey | null;
  memberCount: number;
  pendingDeviceCount: number;
  updatedAt: string;
};

export async function listDiaries(deviceId: string): Promise<DiarySummaryRow[]> {
  const rows = await call<
    {
      id: string;
      role: Role;
      key_version: number;
      meta: Sealed;
      meta_key_version: number;
      share: WrappedKey | null;
      member_count: number;
      pending_device_count: number;
      updated_at: string;
    }[]
  >('cd_list_diaries', {p_device_id: deviceId});
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    keyVersion: row.key_version,
    meta: row.meta,
    metaKeyVersion: row.meta_key_version,
    share: row.share,
    memberCount: row.member_count,
    pendingDeviceCount: row.pending_device_count,
    updatedAt: row.updated_at,
  }));
}

export const createDiary = (input: {
  diaryId: string;
  meta: Sealed;
  displayName: string;
  termsVersion: string;
  deviceId: string;
  deviceShare: WrappedKey;
  recoveryPublicKey: PublicJwk;
  recoveryPrivate: EncryptedPrivateKey;
  recoveryShare: WrappedKey;
}) =>
  call<void>('cd_create_diary', {
    p_diary_id: input.diaryId,
    p_meta: input.meta,
    p_display_name: input.displayName,
    p_terms_version: input.termsVersion,
    p_device_id: input.deviceId,
    p_device_share: input.deviceShare,
    p_recovery_public_key: input.recoveryPublicKey,
    p_recovery_private: input.recoveryPrivate,
    p_recovery_share: input.recoveryShare,
  });

export type Member = {userId: string; displayName: string; role: Role; joinedAt: string; email: string | null};
export type Invite = {id: string; email: string; role: Exclude<Role, 'owner'>; createdAt: string};
export type PendingDevice = {deviceId: string; userId: string; displayName: string; label: string; publicKey: PublicJwk; createdAt: string};
export type ShareTarget = {deviceId: string; publicKey: PublicJwk};

export type DiaryDetails = {
  id: string;
  role: Role;
  myUserId: string;
  keyVersion: number;
  meta: Sealed;
  metaKeyVersion: number;
  needsRotation: boolean;
  shares: {keyVersion: number; wrapped: WrappedKey}[];
  members: Member[];
  invites: Invite[];
  pendingDevices: PendingDevice[];
  shareTargets: ShareTarget[];
};

type DiaryDetailsRow = {
  id: string;
  role: Role;
  my_user_id: string;
  key_version: number;
  meta: Sealed;
  meta_key_version: number;
  needs_rotation: boolean;
  shares: {key_version: number; wrapped: WrappedKey}[];
  members: {user_id: string; display_name: string; role: Role; joined_at: string; email: string | null}[];
  invites: {id: string; email: string; role: Exclude<Role, 'owner'>; created_at: string}[];
  pending_devices: {device_id: string; user_id: string; display_name: string; label: string; public_key: PublicJwk; created_at: string}[];
  share_targets: {device_id: string; public_key: PublicJwk}[];
};

export async function getDiary(diaryId: string, deviceId: string): Promise<DiaryDetails> {
  const row = await call<DiaryDetailsRow>('cd_get_diary', {p_diary_id: diaryId, p_device_id: deviceId});
  return {
    id: row.id,
    role: row.role,
    myUserId: row.my_user_id,
    keyVersion: row.key_version,
    meta: row.meta,
    metaKeyVersion: row.meta_key_version,
    needsRotation: row.needs_rotation,
    shares: row.shares.map((share) => ({keyVersion: share.key_version, wrapped: share.wrapped})),
    members: row.members.map((member) => ({
      userId: member.user_id,
      displayName: member.display_name,
      role: member.role,
      joinedAt: member.joined_at,
      email: member.email,
    })),
    invites: row.invites.map((invite) => ({id: invite.id, email: invite.email, role: invite.role, createdAt: invite.created_at})),
    pendingDevices: row.pending_devices.map((device) => ({
      deviceId: device.device_id,
      userId: device.user_id,
      displayName: device.display_name,
      label: device.label,
      publicKey: device.public_key,
      createdAt: device.created_at,
    })),
    shareTargets: row.share_targets.map((target) => ({deviceId: target.device_id, publicKey: target.public_key})),
  };
}

export const updateMeta = (diaryId: string, meta: Sealed, keyVersion: number) =>
  call<void>('cd_update_meta', {p_diary_id: diaryId, p_meta: meta, p_key_version: keyVersion});

export const deleteDiary = (diaryId: string) => call<void>('cd_delete_diary', {p_diary_id: diaryId});

// ---------------------------------------------------------------------------
// Key versions
// ---------------------------------------------------------------------------

export type ShareInput = {deviceId: string; keyVersion: number; wrapped: WrappedKey};

const toShareRows = (shares: ShareInput[]) =>
  shares.map((share) => ({device_id: share.deviceId, key_version: share.keyVersion, wrapped: share.wrapped}));

export const shareKeys = (diaryId: string, shares: ShareInput[]) =>
  call<number>('cd_share_keys', {p_diary_id: diaryId, p_shares: toShareRows(shares)});

export const rotateKey = (diaryId: string, newVersion: number, meta: Sealed, shares: ShareInput[]) =>
  call<void>('cd_rotate_key', {p_diary_id: diaryId, p_new_version: newVersion, p_meta: meta, p_shares: toShareRows(shares)});

export type RecoveryBundle = {deviceId: string; encryptedPrivateKey: EncryptedPrivateKey; shares: {keyVersion: number; wrapped: WrappedKey}[]};

export async function getRecovery(diaryId: string): Promise<RecoveryBundle> {
  const row = await call<{device_id: string; encrypted_private_key: EncryptedPrivateKey; shares: {key_version: number; wrapped: WrappedKey}[]}>(
    'cd_get_recovery',
    {p_diary_id: diaryId},
  );
  return {
    deviceId: row.device_id,
    encryptedPrivateKey: row.encrypted_private_key,
    shares: row.shares.map((share) => ({keyVersion: share.key_version, wrapped: share.wrapped})),
  };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const invite = (diaryId: string, email: string, role: Exclude<Role, 'owner'>) =>
  call<string>('cd_invite', {p_diary_id: diaryId, p_email: email, p_role: role});

export const cancelInvite = (inviteId: string) => call<void>('cd_cancel_invite', {p_invite_id: inviteId});

export type MyInvite = {id: string; diaryId: string; role: Exclude<Role, 'owner'>; createdAt: string; invitedByName: string | null; invitedByEmail: string | null};

export async function listMyInvites(): Promise<MyInvite[]> {
  const rows = await call<
    {id: string; diary_id: string; role: Exclude<Role, 'owner'>; created_at: string; invited_by_name: string | null; invited_by_email: string | null}[]
  >('cd_list_my_invites');
  return rows.map((row) => ({
    id: row.id,
    diaryId: row.diary_id,
    role: row.role,
    createdAt: row.created_at,
    invitedByName: row.invited_by_name,
    invitedByEmail: row.invited_by_email,
  }));
}

export const acceptInvite = (inviteId: string, displayName: string) =>
  call<string>('cd_accept_invite', {p_invite_id: inviteId, p_display_name: displayName});

export const declineInvite = (inviteId: string) => call<void>('cd_decline_invite', {p_invite_id: inviteId});

export const setRole = (diaryId: string, userId: string, role: Exclude<Role, 'owner'>) =>
  call<void>('cd_set_role', {p_diary_id: diaryId, p_user_id: userId, p_role: role});

export const removeMember = (diaryId: string, userId: string) =>
  call<void>('cd_remove_member', {p_diary_id: diaryId, p_user_id: userId});

export const setDisplayName = (diaryId: string, displayName: string) =>
  call<void>('cd_set_display_name', {p_diary_id: diaryId, p_display_name: displayName});

// ---------------------------------------------------------------------------
// Entries and topics
// ---------------------------------------------------------------------------

export type SealedRecord = {id: string; authorId: string | null; keyVersion: number; payload: Sealed; createdAt: string; updatedAt: string};

type SealedRow = {id: string; author_id: string | null; key_version: number; payload: Sealed; created_at: string; updated_at: string};

const toSealedRecord = (row: SealedRow): SealedRecord => ({
  id: row.id,
  authorId: row.author_id,
  keyVersion: row.key_version,
  payload: row.payload,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listEntries(diaryId: string): Promise<SealedRecord[]> {
  return (await call<SealedRow[]>('cd_list_entries', {p_diary_id: diaryId})).map(toSealedRecord);
}

export const saveEntry = (diaryId: string, entryId: string, keyVersion: number, payload: Sealed) =>
  call<void>('cd_save_entry', {p_diary_id: diaryId, p_entry_id: entryId, p_key_version: keyVersion, p_payload: payload});

export const deleteEntry = (diaryId: string, entryId: string) => call<void>('cd_delete_entry', {p_diary_id: diaryId, p_entry_id: entryId});

export async function listTopics(diaryId: string): Promise<SealedRecord[]> {
  return (await call<SealedRow[]>('cd_list_topics', {p_diary_id: diaryId})).map(toSealedRecord);
}

export const saveTopic = (diaryId: string, topicId: string, keyVersion: number, payload: Sealed) =>
  call<void>('cd_save_topic', {p_diary_id: diaryId, p_topic_id: topicId, p_key_version: keyVersion, p_payload: payload});

export const deleteTopic = (diaryId: string, topicId: string) => call<void>('cd_delete_topic', {p_diary_id: diaryId, p_topic_id: topicId});

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export const deleteAccount = () => call<void>('cd_delete_account');
