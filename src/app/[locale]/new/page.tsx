import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {AppSession} from '@/components/session/AppSession';
import {NewDiaryScreen} from './NewDiaryScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('NewDiary');
  return {title: `${t('title')} · curadiário`};
}

// /new · Create a diary: name, what it records, terms; then the recovery code.
export default function NewDiaryPage() {
  return (
    <AppSession>
      <NewDiaryScreen />
    </AppSession>
  );
}
