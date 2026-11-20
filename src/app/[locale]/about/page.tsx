import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {LegalPage} from '@/components/legal/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('About');
  return {title: `${t('title')} · curadiário`, description: t('intro')};
}

// /about · What curadiário is, what to do in a crisis, how to tell a real link from a scam, who makes it, the code.
export default function AboutPage() {
  return <LegalPage namespace="About" sections={['what', 'crisis', 'safety', 'who', 'code']} />;
}
