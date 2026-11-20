'use client';

import {useEffect, useState} from 'react';
import {useFormatter, useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import styles from '@/components/diary/Diary.module.css';
import {useSession} from '@/components/session/AppSession';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {LegalLinks} from '@/components/legal/LegalLinks';
import {useLoader} from '@/hooks/use-loader';
import {useRpcErrorMessage} from '@/i18n/errors';
import {Link} from '@/i18n/navigation';
import * as api from '@/lib/api';
import {fingerprint} from '@/lib/crypto';
import {forgetDevice} from '@/lib/device-keys';
import {supabase} from '@/lib/supabase';

export function AccountScreen() {
  const t = useTranslations('Account');
  const common = useTranslations('Common');
  const format = useFormatter();
  const errorMessage = useRpcErrorMessage();
  const {email, device, userId} = useSession();
  const devices = useLoader(`devices:${device.deviceId}`, () => api.listDevices(device.deviceId));
  const [print, setPrint] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fingerprint(device.publicJwk).then(setPrint);
  }, [device.publicJwk]);

  async function handleRevoke(target: api.DeviceInfo) {
    if (!window.confirm(t('revokeConfirm', {label: target.label || t('unknownDevice')}))) return;
    try {
      await api.revokeDevice(target.id);
      await devices.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleDelete() {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await api.deleteAccount();
      await forgetDevice(userId);
      await supabase.auth.signOut();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <main className={screen.screen}>
      <AppHeader />
      <Link href="/" className={blocks.back}>
        {t('back')}
      </Link>
      <section className={screen.stack}>
        <h1 className={blocks.title}>{t('title')}</h1>
        <p className={blocks.lead}>{t('signedInAs', {email})}</p>
      </section>

      <Card variant="large">
        <div className={screen.stack}>
          <h2 className={screen.sectionTitle}>{t('thisDevice')}</h2>
          <p className={blocks.lead}>{t('thisDeviceBody')}</p>
          <span className={styles.fingerprint}>{print}</span>
        </div>
      </Card>

      <section className={screen.section} aria-labelledby="devices-title">
        <h2 id="devices-title" className={screen.sectionTitle}>
          {t('devices')}
        </h2>
        <p className={screen.sectionHint}>{t('devicesHint')}</p>
        {devices.isLoading && <p className={blocks.muted}>{common('loading')}</p>}
        <Card variant="flush">
          <ul className={blocks.list}>
            {(devices.data ?? []).map((item) => (
              <li key={item.id} className={blocks.listItem}>
                <span className={blocks.listMain}>
                  <span className={blocks.listTitle}>
                    {item.label || t('unknownDevice')}
                    {item.id === device.deviceId ? ` ${t('current')}` : ''}
                  </span>
                  <span className={blocks.muted}>
                    {t('lastSeen', {date: format.dateTime(new Date(item.lastSeenAt), {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})})}
                  </span>
                </span>
                {item.id !== device.deviceId && (
                  <Button variant="ghost" onClick={() => void handleRevoke(item)}>
                    {t('revoke')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {error && (
        <p className={screen.formError} role="alert">
          {error}
        </p>
      )}

      <Button variant="secondary" onClick={() => void handleSignOut()}>
        {t('signOut')}
      </Button>
      <p className={blocks.muted}>{t('signOutHint')}</p>
      <Button variant="ghost" onClick={() => void handleDelete()}>
        {t('delete')}
      </Button>

      <footer className={screen.footer}>
        <LegalLinks />
      </footer>
    </main>
  );
}
