'use client';

import {useTranslations} from 'next-intl';
import type {LevelOption} from './Controls';
import {aggressionValues, formatMood, moodValues, type AggressionLevel, type Mood} from '@/lib/diary';

const moodKeys = {3: 'plus3', 2: 'plus2', 1: 'plus1', 0: 'zero', [-1]: 'minus1', [-2]: 'minus2', [-3]: 'minus3'} as const;

/** Names and examples of the mood and aggression levels, from messages → Mood / Aggression. */
export function useScaleLabels() {
  const mood = useTranslations('Mood');
  const aggression = useTranslations('Aggression');

  const moodTitle = (value: Mood) => mood(`${moodKeys[value]}.title`);
  const aggressionTitle = (value: AggressionLevel) => aggression(`level${value}.title`);

  const moodOptions: LevelOption<Mood>[] = moodValues.map((value) => ({
    value,
    badge: formatMood(value),
    title: moodTitle(value),
    hint: mood(`${moodKeys[value]}.hint`),
  }));
  const aggressionOptions: LevelOption<AggressionLevel>[] = aggressionValues.map((value) => ({
    value,
    badge: String(value),
    title: aggressionTitle(value),
    hint: aggression(`level${value}.hint`),
  }));

  return {moodTitle, aggressionTitle, moodOptions, aggressionOptions};
}
