import {Suspense} from 'react';
import {CallbackScreen} from './CallbackScreen';

// /auth/callback · Where the magic link lands: exchanges the one-time code for a session.
export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackScreen />
    </Suspense>
  );
}
