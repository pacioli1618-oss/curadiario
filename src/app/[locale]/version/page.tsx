import type {Metadata} from 'next';
import {useTranslations} from 'next-intl';
import {getTranslations} from 'next-intl/server';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {Card} from '@/components/ui/Card';
import {Link} from '@/i18n/navigation';
import {appCommit, appVersion} from '@/lib/app-version';
import {site} from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Version');
  return {title: `${t('title')} · curadiário`};
}

// Newest first. Each key has a date and up to MAX_ITEMS items in messages → Version.releases.
// Keep in step with CHANGELOG.md (the developer's version of the same list).
const releases = [{key: 'r0_1_0', version: '0.1.0'}] as const;
const MAX_ITEMS = 8;

// /version · Which version is running and what changed, in plain words.
export default function VersionPage() {
  const t = useTranslations('Version');
  // Item keys are built at runtime; npm run i18n:check still guarantees every locale has them.
  const loose = t as unknown as {(key: string): string; has: (key: string) => boolean};

  return (
    <main className={screen.screen}>
      <AppHeader />
      <Link href="/" className={blocks.back}>
        {t('back')}
      </Link>
      <section className={screen.stack}>
        <h1 className={blocks.title}>{t('title')}</h1>
        <p className={blocks.lead}>
          {t('current', {version: appVersion})}
          {appCommit && <span className={blocks.mono}> · {appCommit}</span>}
        </p>
        <p className={blocks.notice}>{t('pilot')}</p>
      </section>

      {releases.map(({key, version}) => (
        <Card key={key} variant="large">
          <div className={screen.stack}>
            <div className={blocks.split}>
              <h2 className={screen.sectionTitle}>{t('release', {version})}</h2>
              <span className={blocks.muted}>{t(`releases.${key}.date`)}</span>
            </div>
            <ul className={screen.stack} style={{margin: 0, paddingLeft: 18}}>
              {Array.from({length: MAX_ITEMS}, (_, index) => `releases.${key}.i${index + 1}`)
                .filter((path) => loose.has(path))
                .map((path) => (
                  <li key={path}>{loose(path)}</li>
                ))}
            </ul>
          </div>
        </Card>
      ))}

      <p className={blocks.muted}>
        {t.rich('code', {
          repo: (chunks) => (
            <a href={site.repositoryUrl} target="_blank" rel="noopener noreferrer">
              {chunks}
            </a>
          ),
        })}
      </p>
    </main>
  );
}
