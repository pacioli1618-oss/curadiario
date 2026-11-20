'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {StatusScreen} from '@/components/layout/StatusScreen';
import {ButtonLink} from '@/components/ui/Button';
import {useRouter} from '@/i18n/navigation';
import {writePendingEmail} from '@/lib/device-store';
import {supabase} from '@/lib/supabase';

// The Supabase client exchanges the ?code= by itself (detectSessionInUrl); getSession() waits for
// that, so here we only wait and move on.
export function CallbackScreen() {
  const t = useTranslations('Callback');
  const router = useRouter();
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    let isActive = true;
    void supabase.auth.getSession().then(({data}) => {
      if (!isActive) return;
      if (!data.session) {
        // A link opened in another browser (or the e-mail app's own browser) has no PKCE verifier here.
        setHasFailed(true);
        return;
      }
      writePendingEmail('');
      router.replace('/');
    });
    return () => {
      isActive = false;
    };
  }, [router]);

  if (hasFailed) {
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
