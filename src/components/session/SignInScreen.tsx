'use client';

import {useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {LegalLinks} from '@/components/legal/LegalLinks';
import {CrisisNotice} from '@/components/diary/CrisisNotice';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {TextField} from '@/components/ui/TextField';
import {Link} from '@/i18n/navigation';
import {readPendingEmail, writePendingEmail} from '@/lib/device-store';
import {site} from '@/lib/site';
import {supabase} from '@/lib/supabase';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** E-mail → magic link (or a 6-digit code typed here, for when the link opens elsewhere). */
export function SignInScreen() {
  const t = useTranslations('SignIn');
  const [email, setEmail] = useState(() => (typeof window === 'undefined' ? '' : readPendingEmail()));
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError(t('emailInvalid'));
      return;
    }
    setIsBusy(true);
    setError(null);
    const origin = site.siteUrl ?? window.location.origin;
    const {error: failure} = await supabase.auth.signInWithOtp({
      email: address,
      options: {emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: true},
    });
    setIsBusy(false);
    if (failure) {
      setError(failure.status === 429 ? t('tooMany') : t('sendFailed'));
      return;
    }
    writePendingEmail(address);
    setEmail(address);
    setStep('sent');
  }

  async function handleCode(event: FormEvent) {
    event.preventDefault();
    const token = code.replace(/\D/g, '');
    if (token.length < 6) {
      setError(t('codeInvalid'));
      return;
    }
    setIsBusy(true);
    setError(null);
    const {error: failure} = await supabase.auth.verifyOtp({email, token, type: 'email'});
    setIsBusy(false);
    if (failure) setError(t('codeInvalid'));
    else writePendingEmail('');
  }

  return (
    <main className={screen.screen}>
      <AppHeader />
      {step === 'email' ? (
        <>
          <section className={screen.stack}>
            <h1 className={blocks.title}>{t('headline')}</h1>
            <p className={blocks.lead}>{t('intro')}</p>
          </section>
          <Card variant="large">
            <form className={screen.stack} onSubmit={handleSend} noValidate>
              <TextField
                label={t('emailLabel')}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={error}
              />
              <Button type="submit" size="cta" isFullWidth isLoading={isBusy}>
                {t('send')}
              </Button>
              <p className={blocks.muted}>
                {t.rich('consent', {
                  terms: (chunks) => <Link href="/terms">{chunks}</Link>,
                  privacy: (chunks) => <Link href="/privacy">{chunks}</Link>,
                })}
              </p>
            </form>
          </Card>
        </>
      ) : (
        <>
          <section className={screen.stack}>
            <h1 className={blocks.title}>{t('sentTitle')}</h1>
            <p className={blocks.lead}>{t('sentBody', {email})}</p>
          </section>
          <Card variant="large">
            <form className={screen.stack} onSubmit={handleCode} noValidate>
              <TextField
                label={t('codeLabel')}
                hint={t('codeHint')}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                error={error}
              />
              <Button type="submit" isFullWidth isLoading={isBusy}>
                {t('codeSubmit')}
              </Button>
            </form>
          </Card>
          <Button
            variant="ghost"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          >
            {t('otherEmail')}
          </Button>
        </>
      )}
      <footer className={screen.footer}>
        <CrisisNotice />
        <LegalLinks />
      </footer>
    </main>
  );
}
