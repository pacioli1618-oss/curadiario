'use client';

import {useState} from 'react';
import {useFormatter, useTranslations} from 'next-intl';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import styles from '@/components/diary/Diary.module.css';
import {useScaleLabels} from '@/components/diary/labels';
import {useSession} from '@/components/session/AppSession';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {useRpcErrorMessage} from '@/i18n/errors';
import * as api from '@/lib/api';
import {formatMinutes, formatMood, intensityKeys, sleepMinutes, type DatedEntry, type DiaryMeta} from '@/lib/diary';
import type {OpenDiary} from './DiaryScreen';
import {PendingDevicesCard} from './PendingDevicesCard';

export function EntriesTab({
  diary,
  onNew,
  onEdit,
  onChanged,
  onExport,
}: {
  diary: OpenDiary;
  onNew: () => void;
  onEdit: (entry: DatedEntry) => void;
  onChanged: () => Promise<void>;
  onExport: () => void;
}) {
  const t = useTranslations('Entries');
  const {details, entries, unreadable} = diary;
  const canWrite = details.role !== 'reader';

  return (
    <>
      {details.role !== 'reader' && details.pendingDevices.length > 0 && <PendingDevicesCard diary={diary} onChanged={onChanged} />}
      {!canWrite && <p className={blocks.notice}>{t('readOnly')}</p>}
      {canWrite && (
        <Button size="cta" isFullWidth onClick={onNew}>
          {t('new')}
        </Button>
      )}
      <Button variant="secondary" isFullWidth onClick={onExport}>
        {t('export')}
      </Button>
      {entries.length === 0 && <p className={blocks.lead}>{t('empty')}</p>}
      {entries.map((entry) => (
        <EntryCard key={entry.id} diary={diary} entry={entry} onEdit={() => onEdit(entry)} onChanged={onChanged} />
      ))}
      {unreadable > 0 && <p className={blocks.muted}>{t('unreadable', {count: unreadable})}</p>}
    </>
  );
}

/** Details lines of an entry: one per block that has something. */
export function useEntryDetails() {
  const t = useTranslations('Entry');
  const {aggressionTitle} = useScaleLabels();
  const loose = t as unknown as (key: string) => string;
  const label = (group: string, code: string) => {
    const key = `${group}.${code}`;
    return (t as unknown as {has: (key: string) => boolean}).has(key) ? loose(key) : code;
  };

  return (entry: DatedEntry, meta: DiaryMeta) => {
    const content = entry.content;
    const lines: {key: string; value: string}[] = [];
    if (content.aggression && content.aggression.level > 0) {
      const targets = content.aggression.targets.map((target) => label('targets', target)).join(', ');
      lines.push({key: t('details.aggression'), value: `${content.aggression.level} · ${aggressionTitle(content.aggression.level)}${targets ? ` · ${targets}` : ''}`});
    }
    const intensities = intensityKeys
      .filter((key) => typeof content.intensities?.[key] === 'number')
      .map((key) => `${label('intensities', key)} ${content.intensities?.[key]}`);
    if (intensities.length) lines.push({key: t('details.intensities'), value: intensities.join(' · ')});
    if (content.sleep) {
      const minutes = sleepMinutes(content.sleep.from, content.sleep.to);
      lines.push({
        key: t('details.sleep'),
        value: [
          minutes !== null ? `${formatMinutes(minutes)} (${content.sleep.from}–${content.sleep.to})` : null,
          t('wakes', {count: content.sleep.wakes}),
          label('food', content.sleep.food),
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
    if (content.medication) {
      const doses = Object.entries(content.medication.doses);
      const off = doses.filter(([, state]) => state !== 'taken');
      const name = (id: string) => meta.medicines.find((medicine) => medicine.id === id)?.name ?? t('removedMedicine');
      if (doses.length) {
        lines.push({
          key: t('details.medication'),
          value: off.length ? off.map(([id, state]) => `${name(id)}: ${label('dose', state)}`).join(' · ') : t('allTaken'),
        });
      }
      if (content.medication.sideEffects) lines.push({key: t('details.sideEffects'), value: content.medication.sideEffects});
    }
    if (content.events && (content.events.tags.length || content.events.text)) {
      lines.push({
        key: t('details.events'),
        value: [content.events.tags.map((tag) => label('events', tag)).join(', '), content.events.text].filter(Boolean).join(' · '),
      });
    }
    if (content.strategies && (content.strategies.tags.length || content.strategies.helped)) {
      lines.push({
        key: t('details.strategies'),
        value: [
          content.strategies.tags.map((tag) => label('strategies', tag)).join(', '),
          content.strategies.helped ? t('helped', {text: content.strategies.helped}) : '',
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
    if (content.forConsultation) lines.push({key: t('details.consultation'), value: t('forConsultation')});
    return lines;
  };
}

function EntryCard({diary, entry, onEdit, onChanged}: {diary: OpenDiary; entry: DatedEntry; onEdit: () => void; onChanged: () => Promise<void>}) {
  const t = useTranslations('Entry');
  const format = useFormatter();
  const errorMessage = useRpcErrorMessage();
  const {userId} = useSession();
  const {moodTitle} = useScaleLabels();
  const details = useEntryDetails();
  const [error, setError] = useState<string | null>(null);
  const {content} = entry;
  const author = diary.details.members.find((member) => member.userId === entry.authorId)?.displayName ?? t('formerMember');
  const isMine = entry.authorId === userId;
  const canDelete = isMine || diary.details.role === 'owner';
  const loose = t as unknown as (key: string) => string;

  async function handleDelete() {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await api.deleteEntry(diary.details.id, entry.id);
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <Card>
      <article className={styles.entry}>
        <div className={styles.entryTop}>
          <span className={styles.entryWhen}>
            {format.dateTime(new Date(content.writtenAt), {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}
          </span>
          <span className={styles.entryMood}>
            {formatMood(content.mood)} · {moodTitle(content.mood)}
          </span>
        </div>
        <span className={blocks.muted}>{t(content.reporter === 'self' ? 'reporterSelf' : 'reporterObserved', {name: author})}</span>
        {content.words.length > 0 && (
          <div className={styles.chips}>
            {content.words.map((word) => (
              <span key={word} className={styles.wordTag}>
                {(t as unknown as {has: (key: string) => boolean}).has(`words.${word}`) ? loose(`words.${word}`) : word}
              </span>
            ))}
          </div>
        )}
        {content.note && <p className={styles.entryNote}>{content.note}</p>}
        {details(entry, diary.meta).map((line) => (
          <div key={line.key} className={styles.detail}>
            <span className={styles.detailKey}>{line.key}</span>
            <span>{line.value}</span>
          </div>
        ))}
        {(isMine || canDelete) && diary.details.role !== 'reader' && (
          <div className={styles.entryActions}>
            {isMine && (
              <Button variant="ghost" onClick={onEdit}>
                {t('edit')}
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" onClick={() => void handleDelete()}>
                {t('delete')}
              </Button>
            )}
          </div>
        )}
        {error && (
          <p className={screen.formError} role="alert">
            {error}
          </p>
        )}
      </article>
    </Card>
  );
}
