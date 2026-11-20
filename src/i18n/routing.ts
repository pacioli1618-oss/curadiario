import {defineRouting} from 'next-intl/routing';
import {defaultLocale, locales} from './locales';

// localePrefix 'never': URLs never carry the locale.
// Links (/w/<slug>/invite) are the same for everyone, and each person sees the UI in their own
// language. The proxy rewrites internally to /<locale>/…, picking the locale from the cookie,
// then from Accept-Language.
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'never',
  localeCookie: {
    name: 'CD_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
  },
});
