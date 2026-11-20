import {useTranslations} from 'next-intl';
import styles from './Diary.module.css';

/** "Not a care service, not an emergency line: 188 / 192." Shown wherever someone starts writing. */
export function CrisisNotice({variant = 'general'}: {variant?: 'general' | 'risk' | 'self'}) {
  const t = useTranslations('Crisis');
  return (
    <p className={styles.crisis} role={variant === 'general' ? undefined : 'note'}>
      {t(variant)}
    </p>
  );
}
