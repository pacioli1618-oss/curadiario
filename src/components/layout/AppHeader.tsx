import {Logo} from '@/components/brand/Logo';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import {ThemeSwitcher} from '@/components/ThemeSwitcher';
import {locales} from '@/i18n/locales';
import {Link} from '@/i18n/navigation';
import styles from './Screen.module.css';

/** Logo (back to the home page) and the theme and language switchers, on every screen. */
export function AppHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" aria-label="curadiário" className={styles.logoLink}>
        <Logo />
      </Link>
      <div className={styles.headerControls}>
        <ThemeSwitcher />
        {locales.length > 1 && <LocaleSwitcher />}
      </div>
    </header>
  );
}
