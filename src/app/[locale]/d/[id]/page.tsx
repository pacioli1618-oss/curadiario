import {Suspense} from 'react';
import {AppSession} from '@/components/session/AppSession';
import {DiaryScreen} from './DiaryScreen';

// /d/[id] · One diary: entries, questions for the consultation, summary, people.
export default function DiaryPage({params}: PageProps<'/[locale]/d/[id]'>) {
  return (
    <Suspense>
      <Route params={params} />
    </Suspense>
  );
}

async function Route({params}: {params: PageProps<'/[locale]/d/[id]'>['params']}) {
  const {id} = await params;
  return (
    <AppSession>
      <DiaryScreen diaryId={id} />
    </AppSession>
  );
}
