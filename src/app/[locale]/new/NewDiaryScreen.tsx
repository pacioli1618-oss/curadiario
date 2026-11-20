'use client';

import {useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {RecoveryCodeCard} from '@/components/diary/RecoveryCodeCard';
import {BlockToggles, MedicinesEditor} from '@/components/diary/DiarySettingsFields';
import {useSession} from '@/components/session/AppSession';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {TextField} from '@/components/ui/TextField';
import {Toggle} from '@/components/ui/Toggle';
import {useRpcErrorMessage} from '@/i18n/errors';
import {Link, useRouter} from '@/i18n/navigation';
import {defaultBlocks, NAME_MAX_LENGTH, type BlockKey, type Medicine} from '@/lib/diary';
import {site} from '@/lib/site';
import {createDiary} from '@/lib/vault';

export function NewDiaryScreen() {
  const t = useTranslations('NewDiary');
  const errorMessage = useRpcErrorMessage();
  const router = useRouter();
  const {device, email} = useSession();
  const [diaryName, setDiaryName] = useState('');
  const [myName, setMyName] = useState(() => email.split('@')[0] ?? '');
  const [blockValues, setBlockValues] = useState<Record<BlockKey, boolean>>(defaultBlocks);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [created, setCreated] = useState<{diaryId: string; recoveryCode: string} | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!diaryName.trim() || !myName.trim()) {
      setError(t('required'));
      return;
    }
    if (!hasAcceptedTerms) {
      setError(t('termsRequired'));
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      setCreated(
        await createDiary({
          device,
          displayName: myName.trim(),
          termsVersion: site.termsVersion,
          meta: {v: 1, name: diaryName.trim(), blocks: blockValues, medicines: blockValues.medication ? medicines : []},
        }),
      );
    } catch (failure) {
      setError(errorMessage(failure));
    }
    setIsBusy(false);
  }

  if (created) {
    return (
      <main className={screen.screen}>
        <AppHeader />
        <RecoveryCodeCard code={created.recoveryCode} onContinue={() => router.replace(`/d/${created.diaryId}`)} />
      </main>
    );
  }

  return (
    <main className={screen.screen}>
      <AppHeader />
      <Link href="/" className={blocks.back}>
        {t('back')}
      </Link>
      <h1 className={blocks.title}>{t('title')}</h1>
      <form className={screen.stack} onSubmit={handleSubmit} noValidate>
        <Card variant="large">
          <div className={screen.stack}>
            <TextField label={t('diaryName')} hint={t('diaryNameHint')} value={diaryName} maxLength={NAME_MAX_LENGTH} onChange={(event) => setDiaryName(event.target.value)} />
            <TextField label={t('myName')} hint={t('myNameHint')} value={myName} maxLength={NAME_MAX_LENGTH} onChange={(event) => setMyName(event.target.value)} />
          </div>
        </Card>
        <BlockToggles value={blockValues} onChange={setBlockValues} />
        {blockValues.medication && <MedicinesEditor value={medicines} onChange={setMedicines} />}
        <Toggle
          checked={hasAcceptedTerms}
          onChange={setHasAcceptedTerms}
          title={t.rich('terms', {terms: (chunks) => <Link href="/terms">{chunks}</Link>})}
          hint={t('aboutSomeone')}
        />
        {error && (
          <p className={screen.formError} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="cta" isFullWidth isLoading={isBusy}>
          {t('submit')}
        </Button>
      </form>
    </main>
  );
}
