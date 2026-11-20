'use client';

import {useEffect, useState} from 'react';
import {useFormatter, useTranslations} from 'next-intl';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import styles from '@/components/diary/Diary.module.css';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {useRpcErrorMessage} from '@/i18n/errors';
import type * as api from '@/lib/api';
import {fingerprint} from '@/lib/crypto';
import {approveDevices} from '@/lib/vault';
import type {OpenDiary} from './DiaryScreen';

/** Devices waiting for this diary's keys. Approving shares every key version this device holds. */
export function PendingDevicesCard({diary, onChanged}: {diary: OpenDiary; onChanged: () => Promise<void>}) {
  const t = useTranslations('Approvals');
  return (
    <Card variant="large">
      <div className={screen.stack}>
        <h2 className={screen.sectionTitle}>{t('title')}</h2>
        <p className={blocks.muted}>{t('intro')}</p>
        {diary.details.pendingDevices.map((device) => (
          <PendingDevice key={device.deviceId} diary={diary} device={device} onChanged={onChanged} />
        ))}
      </div>
    </Card>
  );
}

function PendingDevice({diary, device, onChanged}: {diary: OpenDiary; device: api.PendingDevice; onChanged: () => Promise<void>}) {
  const t = useTranslations('Approvals');
  const format = useFormatter();
  const errorMessage = useRpcErrorMessage();
  const [print, setPrint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void fingerprint(device.publicKey).then(setPrint);
  }, [device.publicKey]);

  async function handleApprove() {
    setIsBusy(true);
    setError(null);
    try {
      await approveDevices(diary.details.id, diary.ring, [device]);
      await onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
      setIsBusy(false);
    }
  }

  return (
    <div className={screen.stack} style={{borderTop: '1px solid var(--divider)', paddingTop: 12}}>
      <span className={blocks.listTitle}>
        {t('who', {name: device.displayName, label: device.label || t('unknownDevice')})}
      </span>
      <span className={blocks.muted}>{t('since', {date: format.dateTime(new Date(device.createdAt), {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})})}</span>
      <span className={blocks.muted}>{t('fingerprint')}</span>
      <span className={styles.fingerprint}>{print}</span>
      <Button onClick={() => void handleApprove()} isLoading={isBusy}>
        {t('approve')}
      </Button>
      {error && (
        <p className={screen.formError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
