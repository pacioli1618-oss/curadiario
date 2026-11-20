'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {Button} from '@/components/ui/Button';
import {CopyButton} from '@/components/ui/CopyButton';
import {Toggle} from '@/components/ui/Toggle';
import styles from './Diary.module.css';

/** Shown once, right after a diary is created. The only way back in if every device is lost. */
export function RecoveryCodeCard({code, onContinue}: {code: string; onContinue: () => void}) {
  const t = useTranslations('Recovery');
  const [hasSaved, setHasSaved] = useState(false);
  const groups = code.split('-');

  return (
    <section className={screen.stack}>
      <h1 className={blocks.title}>{t('title')}</h1>
      <p className={blocks.lead}>{t('intro')}</p>
      <div className={styles.recoveryCode} aria-label={t('codeLabel')}>
        {groups.slice(0, 3).join('-')}
        <br />
        {groups.slice(3).join('-')}
      </div>
      <div className={blocks.choice}>
        <CopyButton text={code} variant="secondary" />
        <Button variant="secondary" onClick={() => window.print()}>
          {t('print')}
        </Button>
      </div>
      <p className={blocks.notice}>{t('warning')}</p>
      <Toggle checked={hasSaved} onChange={setHasSaved} title={t('saved')} />
      <Button size="cta" isFullWidth disabled={!hasSaved} onClick={onContinue}>
        {t('continue')}
      </Button>
    </section>
  );
}
