'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {StatusScreen} from '@/components/layout/StatusScreen';
import {LegalLinks} from '@/components/legal/LegalLinks';
import {LockIcon} from '@/components/diary/Controls';
import styles from '@/components/diary/Diary.module.css';
import {useSession} from '@/components/session/AppSession';
import {useLoader} from '@/hooks/use-loader';
import {getRpcErrorCode} from '@/i18n/errors';
import {Link} from '@/i18n/navigation';
import * as api from '@/lib/api';
import {readMeta, type DatedEntry, type DiaryMeta} from '@/lib/diary';
import {openEntries, openKeyRing, openMeta, openTopics, rotateKey, type KeyRing, type OpenTopic} from '@/lib/vault';
import {ConsultTab} from './ConsultTab';
import {EntriesTab} from './EntriesTab';
import {EntryForm} from './EntryForm';
import {LockedScreen} from './LockedScreen';
import {PeopleTab} from './PeopleTab';
import {SummaryTab} from './SummaryTab';

export type OpenDiary = {
  details: api.DiaryDetails;
  ring: KeyRing;
  meta: DiaryMeta;
  entries: DatedEntry[];
  unreadable: number;
  topics: OpenTopic[];
};

type Loaded = {kind: 'locked'; details: api.DiaryDetails} | ({kind: 'open'} & OpenDiary);

const tabs = ['entries', 'consult', 'summary', 'people'] as const;
type Tab = (typeof tabs)[number];

export function DiaryScreen({diaryId}: {diaryId: string}) {
  const t = useTranslations('Diary');
  const common = useTranslations('Common');
  const {device} = useSession();
  const [tab, setTab] = useState<Tab>('entries');
  const [editing, setEditing] = useState<DatedEntry | 'new' | null>(null);

  const loader = useLoader<Loaded>(`diary:${diaryId}:${device.deviceId}`, async () => {
    let details = await api.getDiary(diaryId, device.deviceId);
    let ring = await openKeyRing(diaryId, details.shares, device.keyPair.privateKey);
    if (!ring.has(details.keyVersion)) return {kind: 'locked', details};
    const meta = (await openMeta(diaryId, details.meta, details.metaKeyVersion, ring)) ?? readMeta({});

    // Someone left or a device was revoked: the owner's app makes the next key version.
    if (details.needsRotation && details.role === 'owner') {
      await rotateKey(details, ring, meta);
      details = await api.getDiary(diaryId, device.deviceId);
      ring = await openKeyRing(diaryId, details.shares, device.keyPair.privateKey);
    }

    const [entryRecords, topicRecords] = await Promise.all([api.listEntries(diaryId), api.listTopics(diaryId)]);
    const {entries, unreadable} = await openEntries(diaryId, ring, entryRecords);
    const topics = await openTopics(diaryId, ring, topicRecords);
    return {kind: 'open', details, ring, meta, entries, unreadable, topics};
  });

  if (loader.error) {
    const code = getRpcErrorCode(loader.error);
    return <StatusScreen isError message={code === 'not_authorized' ? t('notFound') : common('loadFailed')} />;
  }
  if (!loader.data) return <StatusScreen message={common('loading')} />;
  if (loader.data.kind === 'locked') return <LockedScreen details={loader.data.details} onUnlocked={loader.refresh} />;

  const diary = loader.data;
  const refresh = loader.refresh;

  if (editing) {
    return (
      <EntryForm
        diary={diary}
        entry={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          await refresh();
          setEditing(null);
          setTab('entries');
        }}
      />
    );
  }

  const {details, meta} = diary;
  return (
    <main className={screen.screen}>
      <AppHeader />
      <Link href="/" className={blocks.back}>
        {t('back')}
      </Link>
      <section className={screen.stack}>
        <h1 className={blocks.title}>{meta.name || t('untitled')}</h1>
        <span className={styles.lockLine}>
          <LockIcon />
          {t('status', {count: details.members.length, role: details.role})}
        </span>
      </section>

      <div role="tablist" aria-label={t('tabsLabel')} className={styles.tabs}>
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            className={styles.tab}
            onClick={() => setTab(key)}
          >
            {t(`tabs.${key}`)}
            {key === 'people' && details.pendingDevices.length > 0 && details.role !== 'reader' ? ' •' : ''}
          </button>
        ))}
      </div>

      <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className={screen.stack}>
        {tab === 'entries' && <EntriesTab diary={diary} onNew={() => setEditing('new')} onEdit={setEditing} onChanged={refresh} onExport={() => setTab('summary')} />}
        {tab === 'consult' && <ConsultTab diary={diary} onChanged={refresh} />}
        {tab === 'summary' && <SummaryTab diary={diary} />}
        {tab === 'people' && <PeopleTab diary={diary} onChanged={refresh} />}
      </section>

      <footer className={screen.footer}>
        <LegalLinks />
      </footer>
    </main>
  );
}
