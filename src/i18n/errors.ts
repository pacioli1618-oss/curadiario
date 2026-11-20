import {useTranslations} from 'next-intl';

// cd_* RPCs raise errors whose message is a fixed code; the vault throws a few of its own.
// Messages → Errors uses the same codes as keys.
export const rpcErrorCodes = [
  'not_authenticated',
  'not_authorized',
  'invalid_input',
  'device_not_found',
  'too_many_devices',
  'too_many_diaries',
  'stale_key_version',
  'already_member',
  'diary_full',
  'invite_not_found',
  'member_not_found',
  'invalid_recovery_code',
  'key_missing',
] as const;
export type RpcErrorCode = (typeof rpcErrorCodes)[number];

export function getRpcErrorCode(error: unknown): RpcErrorCode | 'network' | 'unknown' {
  const code = (error as {message?: string} | null | undefined)?.message?.trim();
  if ((rpcErrorCodes as readonly string[]).includes(code ?? '')) return code as RpcErrorCode;
  if (code && /fetch|network|failed to fetch|load failed/i.test(code)) return 'network';
  return 'unknown';
}

/** Turns an RPC or vault error into a message for the person. */
export function useRpcErrorMessage() {
  const t = useTranslations('Errors');
  return (error: unknown) => t(getRpcErrorCode(error));
}
