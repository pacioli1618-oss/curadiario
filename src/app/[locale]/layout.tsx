import type {Metadata, Viewport} from 'next';
import {NextIntlClientProvider} from 'next-intl';
import {getLocale, getTranslations} from 'next-intl/server';
import localFont from 'next/font/local';
import {routing} from '@/i18n/routing';
import {themeScript} from '@/lib/theme';
import '../globals.css';

// Inter (text) and Manrope (titles) served by the app itself (OFL license in app/fonts/OFL.txt):
// opening a link makes no request to Google.
const inter = localFont({
  src: '../fonts/Inter-Variable.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
});
const manrope = localFont({
  src: '../fonts/Manrope-Variable.woff2',
  weight: '200 800',
  variable: '--font-manrope',
  display: 'swap',
});

// With cacheComponents, every root param needs at least one value at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    metadataBase: siteUrl ? new URL(siteUrl) : undefined,
    title: t('title'),
    description: t('description'),
    openGraph: {title: t('title'), description: t('description'), siteName: 'curadiário', type: 'website'},
    // Pilot: keep every page out of search engines.
    robots: {index: false, follow: false},
    // Home-screen app on iPhone (Android reads app/manifest.ts).
    appleWebApp: {capable: true, title: 'curadiário', statusBarStyle: 'default'},
  };
}

// Browser bar color, matching --surface in each theme.
export const viewport: Viewport = {
  themeColor: [
    {media: '(prefers-color-scheme: light)', color: '#f2f4f3'},
    {media: '(prefers-color-scheme: dark)', color: '#111816'},
  ],
};

export default async function LocaleLayout({children}: LayoutProps<'/[locale]'>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before the first paint (src/lib/theme.ts). */}
        <script dangerouslySetInnerHTML={{__html: themeScript}} />
      </head>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
