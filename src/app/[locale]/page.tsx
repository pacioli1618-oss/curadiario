import {AppSession} from '@/components/session/AppSession';
import {HomeScreen} from './HomeScreen';

// Home · Signed out: sign in by e-mail. Signed in: invites, my diaries, create one.
// Everything runs in the browser: the keys live there.
export default function HomePage() {
  return (
    <AppSession>
      <HomeScreen />
    </AppSession>
  );
}
