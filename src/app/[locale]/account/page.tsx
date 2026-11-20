import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {AppSession} from '@/components/session/AppSession';
import {AccountScreen} from './AccountScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Account');
  return {title: `${t('title')} · curadiário`};
}

// /account · My devices (revoke a lost phone), sign out, delete my account.
export default function AccountPage() {
  return (
    <AppSession>
      <AccountScreen />
    </AppSession>
  );
}
