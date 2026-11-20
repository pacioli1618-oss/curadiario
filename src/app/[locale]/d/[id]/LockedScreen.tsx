'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import styles from '@/components/diary/Diary.module.css';
import {useSession} from '@/components/session/AppSession';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {TextField} from '@/components/ui/TextField';
import {useRpcErrorMessage} from '@/i18n/errors';
import {Link} from '@/i18n/navigation';
import type * as api from '@/lib/api';
import {fingerprint, normalizeRecoveryCode} from '@/lib/crypto';
import {recoverWithCode} from '@/lib/vault';

/** This device can't read the diary yet: wait for someone to approve it, or (owner) use the recovery code. */
export function LockedScreen({details, onUnlocked}: {details: api.DiaryDetails; onUnlocked: () => Promise<void>}) {
  const t = useTranslations('Locked');
  const errorMessage = useRpcErrorMessage();
  const {device} = useSession();
  const [print, setPrint] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void fingerprint(device.publicJwk).then(setPrint);
  }, [device.publicJwk]);

  async function handleRecover(event: FormEvent) {
    event.preventDefault();
    if (!normalizeRecoveryCode(code)) {
      setError(t('codeInvalid'));
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await recoverWithCode(details.id, code, device);
      await onUnlocked();
    } catch (failure) {
      setError(errorMessage(failure));
      setIsBusy(false);
    }
  }

  const approvers = details.members.filter((member) => member.role !== 'reader' && member.userId !== details.myUserId);

  return (
    <main className={screen.screen}>
      <AppHeader />
      <Link href="/" className={blocks.back}>
        {t('back')}
      </Link>
      <section className={screen.stack}>
        <h1 className={blocks.title}>{t('title')}</h1>
        <p className={blocks.lead}>{t('intro')}</p>
      </section>

      {approvers.length > 0 && (
        <Card variant="large">
          <div className={screen.stack}>
            <h2 className={screen.sectionTitle}>{t('askTitle')}</h2>
            <p className={blocks.lead}>{t('askBody', {names: approvers.map((member) => member.displayName).join(', ')})}</p>
            <p className={blocks.muted}>{t('fingerprintLabel')}</p>
            <p className={styles.fingerprint}>{print}</p>
            <p className={blocks.muted}>{t('fingerprintHint')}</p>
            <Button variant="secondary" onClick={() => void onUnlocked()}>
              {t('check')}
            </Button>
          </div>
        </Card>
      )}

      {details.role === 'owner' && (
        <Card variant="large">
          <form className={screen.stack} onSubmit={handleRecover} noValidate>
            <h2 className={screen.sectionTitle}>{t('recoverTitle')}</h2>
            <p className={blocks.lead}>{t('recoverBody')}</p>
            <TextField
              label={t('codeLabel')}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              error={error}
            />
            <Button type="submit" isFullWidth isLoading={isBusy}>
              {t('recover')}
            </Button>
          </form>
        </Card>
      )}
    </main>
  );
}
