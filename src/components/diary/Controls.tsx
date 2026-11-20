'use client';

import {useId, useState, type ReactNode} from 'react';
import styles from './Diary.module.css';

export type LevelOption<T extends string | number> = {value: T; badge: string; title: string; hint: string};

/** A qualified scale: one big radio per level, with a short example under its name. */
export function LevelScale<T extends string | number>({
  legend,
  legendHint,
  options,
  value,
  onChange,
}: {
  legend: string;
  legendHint?: string;
  options: LevelOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>
        {legend} {legendHint && <span className={styles.legendHint}>({legendHint})</span>}
      </legend>
      <div role="radiogroup" className={styles.scale}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={styles.level}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.levelBadge}>{option.badge}</span>
            <span className={styles.levelText}>
              <span className={styles.levelTitle}>{option.title}</span>
              <span className={styles.levelHint}>{option.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Two or three side-by-side choices (who reports, food, dose taken…). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  isLabelVisible = true,
}: {
  label: string;
  options: {value: T; label: string}[];
  value: T | null;
  onChange: (value: T) => void;
  isLabelVisible?: boolean;
}) {
  const id = useId();
  return (
    <div>
      {isLabelVisible && (
        <p id={id} className={styles.legend}>
          {label}
        </p>
      )}
      <div role="radiogroup" aria-labelledby={isLabelVisible ? id : undefined} aria-label={isLabelVisible ? undefined : label} className={styles.segmented}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={styles.segment}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Toggle chips: words for the day, events, strategies. */
export function Chips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: {value: string; label: string}[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <p id={id} className={styles.legend}>
        {label}
      </p>
      <div role="group" aria-labelledby={id} className={styles.chips}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected.includes(option.value)}
            className={styles.chip}
            onClick={() => onToggle(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** An optional part of the entry, closed until opened. */
export function Block({title, status, children}: {title: string; status: string; children: ReactNode}) {
  const [isOpen, setIsOpen] = useState(false);
  const id = useId();
  return (
    <section className={styles.block}>
      <button type="button" className={styles.blockHeader} aria-expanded={isOpen} aria-controls={id} onClick={() => setIsOpen(!isOpen)}>
        <span>{title}</span>
        <span className={styles.blockStatus}>{status}</span>
        <svg className={styles.chevron} aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div id={id} className={styles.blockBody}>
          {children}
        </div>
      )}
    </section>
  );
}

export function LockIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
