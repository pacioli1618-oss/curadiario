'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useSearchParams} from 'next/navigation';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {StatusScreen} from '@/components/layout/StatusScreen';
import {ButtonLink} from '@/components/ui/Button';
import {useRouter} from '@/i18n/navigation';
import {writePendingEmail} from '@/lib/device-store';
import {supabase} from '@/lib/supabase';

export function CallbackScreen() {
  const t = useTranslations('Callback');
  const router = useRouter();
  const code = useSearchParams().get('code');
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    if (!code) return;
    let isActive = true;
    void supabase.auth.exchangeCodeForSession(code).then(({error}) => {
      if (!isActive) return;
      if (error) {
        setHasFailed(true);
        return;
      }
      writePendingEmail('');
      router.replace('/');
    });
    return () => {
      isActive = false;
    };
  }, [code, router]);

  // A link opened in another browser (or the e-mail app's own browser) has no PKCE verifier here.
  if (!code || hasFailed) {
    return (
      <main className={screen.screen}>
        <AppHeader />
        <section className={screen.stack}>
          <h1 className={blocks.title}>{t('failedTitle')}</h1>
          <p className={blocks.lead}>{t('failedBody')}</p>
          <ButtonLink href="/" size="cta" isFullWidth>
            {t('back')}
          </ButtonLink>
        </section>
      </main>
    );
  }
  return <StatusScreen message={t('signingIn')} />;
}
