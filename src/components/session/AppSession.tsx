'use client';

import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import type {User} from '@supabase/supabase-js';
import {StatusScreen} from '@/components/layout/StatusScreen';
import * as api from '@/lib/api';
import {exportPublicJwk, generateDeviceKeyPair} from '@/lib/crypto';
import {canKeepKeys, describeThisDevice, forgetDevice, readDevice, writeDevice, type StoredDevice} from '@/lib/device-keys';
import {supabase} from '@/lib/supabase';
import {getRpcErrorCode} from '@/i18n/errors';
import {SignInScreen} from './SignInScreen';

export type Session = {
  userId: string;
  email: string;
  device: StoredDevice;
};

const SessionContext = createContext<Session | null>(null);

/** The signed-in person and this browser's device. Only inside <AppSession>. */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession outside <AppSession>');
  return session;
}

type AuthState = {status: 'loading'} | {status: 'signed-out'} | {status: 'signed-in'; user: User};

function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({status: 'loading'});
  useEffect(() => {
    let isActive = true;
    void supabase.auth.getSession().then(({data}) => {
      if (!isActive) return;
      setState(data.session ? {status: 'signed-in', user: data.session.user} : {status: 'signed-out'});
    });
    const {data} = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? {status: 'signed-in', user: session.user} : {status: 'signed-out'});
    });
    return () => {
      isActive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return state;
}

/**
 * This browser's device for the user: read from IndexedDB, or created and registered now.
 * A device the server no longer knows (revoked from another phone) is replaced by a new one.
 */
async function ensureDevice(userId: string): Promise<StoredDevice> {
  const stored = await readDevice(userId);
  if (stored) {
    try {
      await api.listDevices(stored.deviceId);
      return stored;
    } catch (error) {
      if (getRpcErrorCode(error) !== 'device_not_found') throw error;
      await forgetDevice(userId);
    }
  }
  const keyPair = await generateDeviceKeyPair();
  const publicJwk = await exportPublicJwk(keyPair.publicKey);
  const deviceId = await api.registerDevice(publicJwk, describeThisDevice());
  const device: StoredDevice = {userId, deviceId, keyPair, publicJwk, createdAt: new Date().toISOString()};
  await writeDevice(device);
  return device;
}

/** Shows the sign-in screen until there is a session and a device, then the children. */
export function AppSession({children}: {children: ReactNode}) {
  const t = useTranslations('Session');
  const auth = useAuth();
  const [device, setDevice] = useState<{userId: string; device: StoredDevice} | null>(null);
  const [failure, setFailure] = useState<'storage' | 'network' | null>(null);

  const userId = auth.status === 'signed-in' ? auth.user.id : null;
  useEffect(() => {
    if (!userId) return;
    let isActive = true;
    void (async () => {
      if (!(await canKeepKeys())) {
        if (isActive) setFailure('storage');
        return;
      }
      try {
        const ready = await ensureDevice(userId);
        if (isActive) setDevice({userId, device: ready});
      } catch {
        if (isActive) setFailure('network');
      }
    })();
    return () => {
      isActive = false;
    };
  }, [userId]);

  if (auth.status === 'loading') return <StatusScreen message={t('loading')} />;
  if (auth.status === 'signed-out') return <SignInScreen />;
  if (failure === 'storage') return <StatusScreen isError message={t('noStorage')} />;
  if (failure === 'network') return <StatusScreen isError message={t('deviceFailed')} />;
  if (!device || device.userId !== auth.user.id) return <StatusScreen message={t('preparing')} />;

  return (
    <SessionContext.Provider value={{userId: auth.user.id, email: auth.user.email ?? '', device: device.device}}>
      {children}
    </SessionContext.Provider>
  );
}
