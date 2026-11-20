'use client';

import {useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {Segmented} from '@/components/diary/Controls';
import {BlockToggles, MedicinesEditor} from '@/components/diary/DiarySettingsFields';
import {useSession} from '@/components/session/AppSession';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {CopyButton} from '@/components/ui/CopyButton';
import {TextField} from '@/components/ui/TextField';
import {useOrigin} from '@/hooks/use-origin';
import {useRpcErrorMessage} from '@/i18n/errors';
import {useRouter} from '@/i18n/navigation';
import * as api from '@/lib/api';
import {NAME_MAX_LENGTH, type DiaryMeta} from '@/lib/diary';
import {saveMeta} from '@/lib/vault';
import type {OpenDiary} from './DiaryScreen';
import {PendingDevicesCard} from './PendingDevicesCard';

type InviteRole = Exclude<api.Role, 'owner'>;

export function PeopleTab({diary, onChanged}: {diary: OpenDiary; onChanged: () => Promise<void>}) {
  const t = useTranslations('People');
  const errorMessage = useRpcErrorMessage();
  const router = useRouter();
  const {userId} = useSession();
  const {details} = diary;
  const isOwner = details.role === 'owner';
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function handleRemove(member: api.Member) {
    if (!window.confirm(t('removeConfirm', {name: member.displayName}))) return;
    // onChanged reloads the diary, and DiaryScreen creates the next key version right away
    // (needs_rotation), so whoever left can't read what comes next.
    await run(() => api.removeMember(details.id, member.userId));
  }

  async function handleLeave() {
    if (!window.confirm(t('leaveConfirm'))) return;
    setError(null);
    try {
      await api.removeMember(details.id, userId);
      router.replace('/');
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <>
      {details.role !== 'reader' && details.pendingDevices.length > 0 && <PendingDevicesCard diary={diary} onChanged={onChanged} />}

      <Card variant="flush">
        <ul className={blocks.list}>
          {details.members.map((member) => (
            <li key={member.userId} className={blocks.listItem}>
              <span className={blocks.listMain}>
                <span className={blocks.listTitle}>
                  {member.displayName}
                  {member.userId === userId ? ` ${t('you')}` : ''}
                </span>
                <span className={blocks.muted}>{[t(`roles.${member.role}`), member.email].filter(Boolean).join(' · ')}</span>
              </span>
              {isOwner && member.role !== 'owner' && (
                <span className={blocks.row}>
                  <select
                    aria-label={t('roleFor', {name: member.displayName})}
                    value={member.role}
                    onChange={(event) => void run(() => api.setRole(details.id, member.userId, event.target.value as InviteRole))}
                    style={{height: 40, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-control)', background: 'var(--card)', padding: '0 6px'}}
                  >
                    <option value="writer">{t('roles.writer')}</option>
                    <option value="reader">{t('roles.reader')}</option>
                  </select>
                  <Button variant="ghost" onClick={() => void handleRemove(member)} aria-label={t('removeLabel', {name: member.displayName})}>
                    {t('remove')}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {isOwner && details.invites.length > 0 && (
        <Card variant="flush">
          <ul className={blocks.list}>
            {details.invites.map((invite) => (
              <li key={invite.id} className={blocks.listItem}>
                <span className={blocks.listMain}>
                  <span className={blocks.listTitle}>{invite.email}</span>
                  <span className={blocks.muted}>{t('invitePending', {role: invite.role})}</span>
                </span>
                <Button variant="ghost" onClick={() => void run(() => api.cancelInvite(invite.id))}>
                  {t('cancelInvite')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isOwner && <InviteForm diary={diary} onChanged={onChanged} />}

      {error && (
        <p className={screen.formError} role="alert">
          {error}
        </p>
      )}

      <MyNameCard diary={diary} onChanged={onChanged} />
      {isOwner && <SettingsCard diary={diary} onChanged={onChanged} />}

      {!isOwner && (
        <Button variant="secondary" onClick={() => void handleLeave()}>
          {t('leave')}
        </Button>
      )}
    </>
  );
}

function InviteForm({diary, onChanged}: {diary: OpenDiary; onChanged: () => Promise<void>}) {
  const t = useTranslations('People');
  const errorMessage = useRpcErrorMessage();
  const origin = useOrigin();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('writer');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      const address = email.trim().toLowerCase();
      await api.invite(diary.details.id, address, role);
      setSentTo(address);
      setEmail('');
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    }
    setIsBusy(false);
  }

  return (
    <Card variant="large">
      <form className={screen.stack} onSubmit={handleSubmit} noValidate>
        <h2 className={screen.sectionTitle}>{t('inviteTitle')}</h2>
        <TextField label={t('email')} type="email" inputMode="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} error={error} />
        <Segmented
          label={t('permission')}
          value={role}
          onChange={setRole}
          options={[
            {value: 'writer', label: t('roles.writer')},
            {value: 'reader', label: t('roles.reader')},
          ]}
        />
        <Button type="submit" isLoading={isBusy} disabled={!email.trim()}>
          {t('invite')}
        </Button>
        {sentTo && (
          <div className={screen.stack}>
            <p className={blocks.notice}>{t('inviteSent', {email: sentTo})}</p>
            <CopyButton text={origin} label={t('copyLink')} variant="secondary" />
          </div>
        )}
        <p className={blocks.muted}>{t('inviteHint')}</p>
      </form>
    </Card>
  );
}

function MyNameCard({diary, onChanged}: {diary: OpenDiary; onChanged: () => Promise<void>}) {
  const t = useTranslations('People');
  const errorMessage = useRpcErrorMessage();
  const {userId} = useSession();
  const current = diary.details.members.find((member) => member.userId === userId)?.displayName ?? '';
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    try {
      await api.setDisplayName(diary.details.id, name.trim());
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <Card variant="large">
      <form className={screen.stack} onSubmit={handleSave}>
        <TextField label={t('myName')} value={name} maxLength={NAME_MAX_LENGTH} onChange={(event) => setName(event.target.value)} error={error} />
        <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === current}>
          {t('saveName')}
        </Button>
      </form>
    </Card>
  );
}

/** Owner: diary name, blocks, medicines, delete. Saved encrypted, like everything else. */
function SettingsCard({diary, onChanged}: {diary: OpenDiary; onChanged: () => Promise<void>}) {
  const t = useTranslations('Settings');
  const errorMessage = useRpcErrorMessage();
  const router = useRouter();
  const [meta, setMeta] = useState<DiaryMeta>(diary.meta);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const isChanged = JSON.stringify(meta) !== JSON.stringify(diary.meta);

  async function handleSave() {
    if (!meta.name.trim()) {
      setError(t('nameRequired'));
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await saveMeta(diary.details.id, diary.ring, diary.details.keyVersion, {...meta, name: meta.name.trim()});
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    }
    setIsBusy(false);
  }

  async function handleDelete() {
    const typed = window.prompt(t('deletePrompt', {name: diary.meta.name}));
    if (typed === null) return;
    if (typed.trim() !== diary.meta.name.trim()) {
      setError(t('deleteMismatch'));
      return;
    }
    try {
      await api.deleteDiary(diary.details.id);
      router.replace('/');
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <section className={screen.section} aria-labelledby="settings-title">
      <h2 id="settings-title" className={screen.sectionTitle}>
        {t('title')}
      </h2>
      <Card variant="large">
        <TextField label={t('name')} value={meta.name} maxLength={NAME_MAX_LENGTH} onChange={(event) => setMeta({...meta, name: event.target.value})} />
      </Card>
      <BlockToggles value={meta.blocks} onChange={(blockValues) => setMeta({...meta, blocks: blockValues})} />
      {meta.blocks.medication && <MedicinesEditor value={meta.medicines} onChange={(medicines) => setMeta({...meta, medicines})} />}
      {error && (
        <p className={screen.formError} role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void handleSave()} isLoading={isBusy} disabled={!isChanged}>
        {t('save')}
      </Button>
      <Button variant="ghost" onClick={() => void handleDelete()}>
        {t('delete')}
      </Button>
    </section>
  );
}
