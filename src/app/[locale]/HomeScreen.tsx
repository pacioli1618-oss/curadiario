'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {LegalLinks} from '@/components/legal/LegalLinks';
import {CrisisNotice} from '@/components/diary/CrisisNotice';
import {useSession} from '@/components/session/AppSession';
import {Button, ButtonLink} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Tag} from '@/components/ui/Tag';
import {TextField} from '@/components/ui/TextField';
import {useLoader} from '@/hooks/use-loader';
import {useRpcErrorMessage} from '@/i18n/errors';
import {Link, useRouter} from '@/i18n/navigation';
import * as api from '@/lib/api';
import {NAME_MAX_LENGTH} from '@/lib/diary';
import {openListedMeta} from '@/lib/vault';

type ListedDiary = api.DiarySummaryRow & {name: string | null};

/** Signed in: invites waiting, my diaries, create a new one. */
export function HomeScreen() {
  const t = useTranslations('Home');
  const common = useTranslations('Common');
  const {device, email} = useSession();
  const diaries = useLoader(`diaries:${device.deviceId}`, async () => {
    const rows = await api.listDiaries(device.deviceId);
    return Promise.all(
      rows.map(async (row): Promise<ListedDiary> => ({...row, name: (await openListedMeta(row, device.keyPair.privateKey))?.name ?? null})),
    );
  });
  const invites = useLoader('invites', api.listMyInvites);

  return (
    <main className={screen.screen}>
      <AppHeader />
      <section className={screen.stack}>
        <h1 className={blocks.title}>{t('title')}</h1>
        <p className={blocks.muted}>{t('signedInAs', {email})}</p>
      </section>

      {(invites.data ?? []).map((invite) => (
        <InviteCard key={invite.id} invite={invite} onDone={() => Promise.all([invites.refresh(), diaries.refresh()]).then(() => undefined)} />
      ))}

      <section className={screen.section} aria-labelledby="diaries-title">
        <h2 id="diaries-title" className={screen.sectionTitle}>
          {t('diaries')}
        </h2>
        {diaries.isLoading && !diaries.error && <p className={blocks.muted}>{common('loading')}</p>}
        {diaries.error !== null && <p className={screen.formError}>{common('loadFailed')}</p>}
        {diaries.data?.length === 0 && <p className={blocks.lead}>{t('empty')}</p>}
        {(diaries.data ?? []).map((diary) => (
          <Link key={diary.id} href={`/d/${diary.id}`} className={blocks.listLink}>
            <Card>
              <div className={blocks.split}>
                <div className={blocks.listMain}>
                  <span className={blocks.listTitle}>{diary.name ?? t('locked')}</span>
                  <span className={blocks.muted}>
                    {t('meta', {role: diary.role, count: diary.memberCount})}
                  </span>
                </div>
                {diary.pendingDeviceCount > 0 && <Tag tone="ember">{t('pending', {count: diary.pendingDeviceCount})}</Tag>}
                {!diary.name && <Tag>{t('waiting')}</Tag>}
              </div>
            </Card>
          </Link>
        ))}
        <ButtonLink href="/new" size="cta" isFullWidth>
          {t('create')}
        </ButtonLink>
      </section>

      <Link href="/account" className={blocks.back}>
        {t('account')}
      </Link>

      <footer className={screen.footer}>
        <CrisisNotice />
        <LegalLinks />
      </footer>
    </main>
  );
}

function InviteCard({invite, onDone}: {invite: api.MyInvite; onDone: () => Promise<void>}) {
  const t = useTranslations('Home');
  const errorMessage = useRpcErrorMessage();
  const router = useRouter();
  const {email} = useSession();
  const [name, setName] = useState(() => email.split('@')[0] ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleAccept() {
    if (!name.trim()) {
      setError(t('nameRequired'));
      return;
    }
    setIsBusy(true);
    try {
      const diaryId = await api.acceptInvite(invite.id, name.trim());
      router.push(`/d/${diaryId}`);
    } catch (failure) {
      setError(errorMessage(failure));
      setIsBusy(false);
    }
  }

  async function handleDecline() {
    setIsBusy(true);
    try {
      await api.declineInvite(invite.id);
      await onDone();
    } catch (failure) {
      setError(errorMessage(failure));
    }
    setIsBusy(false);
  }

  return (
    <Card variant="large">
      <div className={screen.stack}>
        <h2 className={screen.sectionTitle}>{t('inviteTitle')}</h2>
        <p className={blocks.lead}>
          {t('inviteBody', {name: invite.invitedByName ?? '', email: invite.invitedByEmail ?? '', role: invite.role})}
        </p>
        <TextField label={t('yourName')} hint={t('yourNameHint')} value={name} maxLength={NAME_MAX_LENGTH} onChange={(event) => setName(event.target.value)} error={error} />
        <div className={blocks.choice}>
          <Button variant="secondary" onClick={() => void handleDecline()} disabled={isBusy}>
            {t('decline')}
          </Button>
          <Button onClick={() => void handleAccept()} isLoading={isBusy}>
            {t('accept')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
