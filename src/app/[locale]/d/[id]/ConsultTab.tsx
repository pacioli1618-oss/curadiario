'use client';

import {useState, type FormEvent} from 'react';
import {useFormatter, useTranslations} from 'next-intl';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {useSession} from '@/components/session/AppSession';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {TextField} from '@/components/ui/TextField';
import {useRpcErrorMessage} from '@/i18n/errors';
import * as api from '@/lib/api';
import {SHORT_TEXT_MAX_LENGTH, type TopicContent} from '@/lib/diary';
import {sealTopic, type OpenTopic} from '@/lib/vault';
import type {OpenDiary} from './DiaryScreen';

/** Questions and points to bring to the doctor or therapist. */
export function ConsultTab({diary, onChanged}: {diary: OpenDiary; onChanged: () => Promise<void>}) {
  const t = useTranslations('Consult');
  const format = useFormatter();
  const errorMessage = useRpcErrorMessage();
  const {details, topics, entries} = diary;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const canWrite = details.role !== 'reader';

  async function save(topicId: string, content: TopicContent) {
    const sealed = await sealTopic(details.id, diary.ring, details.keyVersion, topicId, content);
    await api.saveTopic(details.id, topicId, details.keyVersion, sealed);
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      await save(crypto.randomUUID(), {v: 1, text: text.trim().slice(0, SHORT_TEXT_MAX_LENGTH), done: false});
      setText('');
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    }
    setIsBusy(false);
  }

  async function handleToggle(topic: OpenTopic) {
    try {
      const done = !topic.content.done;
      await save(topic.id, {...topic.content, done, doneAt: done ? new Date().toISOString() : undefined});
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  const pending = topics.filter((topic) => !topic.content.done);
  const done = topics.filter((topic) => topic.content.done);
  const flagged = entries.filter((entry) => entry.content.forConsultation);

  return (
    <>
      <p className={blocks.lead}>{t('intro')}</p>
      {canWrite && (
        <form className={blocks.timeRow} style={{gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'end'}} onSubmit={handleAdd}>
          <TextField label={t('newLabel')} placeholder={t('newPlaceholder')} maxLength={SHORT_TEXT_MAX_LENGTH} value={text} onChange={(event) => setText(event.target.value)} />
          <Button type="submit" isLoading={isBusy} disabled={!text.trim()}>
            {t('add')}
          </Button>
        </form>
      )}
      {error && (
        <p className={screen.formError} role="alert">
          {error}
        </p>
      )}

      <h2 className={screen.sectionTitle}>{t('pending', {count: pending.length})}</h2>
      {pending.length === 0 && <p className={blocks.muted}>{t('nonePending')}</p>}
      {pending.map((topic) => (
        <TopicRow key={topic.id} diary={diary} topic={topic} onToggle={() => void handleToggle(topic)} onChanged={onChanged} />
      ))}

      {flagged.length > 0 && (
        <Card variant="large">
          <div className={screen.stack}>
            <h2 className={screen.sectionTitle}>{t('flagged')}</h2>
            {flagged.map((entry) => (
              <p key={entry.id} className={blocks.lead} style={{margin: 0}}>
                <span className={blocks.muted}>{format.dateTime(new Date(entry.content.writtenAt), {day: 'numeric', month: 'short'})} · </span>
                {entry.content.note || t('noNote')}
              </p>
            ))}
          </div>
        </Card>
      )}

      {done.length > 0 && <h2 className={screen.sectionTitle}>{t('done')}</h2>}
      {done.map((topic) => (
        <TopicRow key={topic.id} diary={diary} topic={topic} onToggle={() => void handleToggle(topic)} onChanged={onChanged} />
      ))}
    </>
  );
}

function TopicRow({diary, topic, onToggle, onChanged}: {diary: OpenDiary; topic: OpenTopic; onToggle: () => void; onChanged: () => Promise<void>}) {
  const t = useTranslations('Consult');
  const format = useFormatter();
  const {userId} = useSession();
  const errorMessage = useRpcErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const author = diary.details.members.find((member) => member.userId === topic.authorId)?.displayName ?? '';
  const canDelete = diary.details.role === 'owner' || (topic.authorId === userId && diary.details.role === 'writer');

  async function handleDelete() {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await api.deleteTopic(diary.details.id, topic.id);
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <Card>
      <div className={blocks.split}>
        <label style={{display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', flex: 1, minWidth: 0}}>
          <input type="checkbox" checked={topic.content.done} onChange={onToggle} style={{width: 20, height: 20, marginTop: 2, accentColor: 'var(--brand)', flex: 'none'}} />
          <span className={blocks.listMain}>
            <span style={{textDecoration: topic.content.done ? 'line-through' : undefined, overflowWrap: 'anywhere'}}>{topic.content.text}</span>
            <span className={blocks.muted}>
              {[author, format.dateTime(new Date(topic.createdAt), {day: 'numeric', month: 'short'})].filter(Boolean).join(' · ')}
            </span>
          </span>
        </label>
        {canDelete && (
          <Button variant="ghost" onClick={() => void handleDelete()} aria-label={t('deleteLabel', {text: topic.content.text})}>
            {t('delete')}
          </Button>
        )}
      </div>
      {error && (
        <p className={screen.formError} role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
