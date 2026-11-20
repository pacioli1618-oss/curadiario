'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {CrisisNotice} from '@/components/diary/CrisisNotice';
import {Block, Chips, LevelScale, LockIcon, Segmented} from '@/components/diary/Controls';
import styles from '@/components/diary/Diary.module.css';
import {useScaleLabels} from '@/components/diary/labels';
import {Button} from '@/components/ui/Button';
import {TextAreaField} from '@/components/ui/TextAreaField';
import {TextField} from '@/components/ui/TextField';
import {Toggle} from '@/components/ui/Toggle';
import {useRpcErrorMessage} from '@/i18n/errors';
import * as api from '@/lib/api';
import {
  aggressionTargets,
  doseStates,
  eventCodes,
  foodLevels,
  formatMinutes,
  intensityKeys,
  NOTE_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  sleepMinutes,
  strategyCodes,
  wordCodes,
  type AggressionLevel,
  type AggressionTarget,
  type DatedEntry,
  type DoseState,
  type EntryContent,
  type FoodLevel,
  type IntensityKey,
  type Mood,
  type Reporter,
} from '@/lib/diary';
import {sealEntry} from '@/lib/vault';
import type {OpenDiary} from './DiaryScreen';

/** "2026-11-20T14:12" for <input type="datetime-local">, in this device's time. */
function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

/** New entry, or editing one of mine. Only the blocks this diary records are shown. */
export function EntryForm({diary, entry, onClose, onSaved}: {diary: OpenDiary; entry: DatedEntry | null; onClose: () => void; onSaved: () => Promise<void>}) {
  const t = useTranslations('EntryForm');
  const labels = useTranslations('Entry');
  const blockNames = useTranslations('Blocks');
  const errorMessage = useRpcErrorMessage();
  const {moodOptions, aggressionOptions} = useScaleLabels();
  const {meta, details} = diary;
  const previous = entry?.content;

  const [writtenAt, setWrittenAt] = useState(() => toLocalInput(previous ? new Date(previous.writtenAt) : new Date()));
  const [reporter, setReporter] = useState<Reporter>(previous?.reporter ?? 'observed');
  const [mood, setMood] = useState<Mood | null>(previous?.mood ?? null);
  const [aggression, setAggression] = useState<AggressionLevel | null>(previous?.aggression?.level ?? null);
  const [targets, setTargets] = useState<AggressionTarget[]>(previous?.aggression?.targets ?? []);
  const [words, setWords] = useState<string[]>(previous?.words ?? []);
  const [note, setNote] = useState(previous?.note ?? '');
  const [intensities, setIntensities] = useState<Partial<Record<IntensityKey, number>>>(previous?.intensities ?? {});
  const [sleepFrom, setSleepFrom] = useState(previous?.sleep?.from ?? '23:00');
  const [sleepTo, setSleepTo] = useState(previous?.sleep?.to ?? '07:00');
  const [wakes, setWakes] = useState(previous?.sleep?.wakes ?? 0);
  const [food, setFood] = useState<FoodLevel>(previous?.sleep?.food ?? 'normal');
  const [hasSleep, setHasSleep] = useState(Boolean(previous?.sleep));
  const [doses, setDoses] = useState<Record<string, DoseState>>(previous?.medication?.doses ?? {});
  const [sideEffects, setSideEffects] = useState(previous?.medication?.sideEffects ?? '');
  const [eventTags, setEventTags] = useState<string[]>(previous?.events?.tags ?? []);
  const [eventText, setEventText] = useState(previous?.events?.text ?? '');
  const [strategyTags, setStrategyTags] = useState<string[]>(previous?.strategies?.tags ?? []);
  const [helped, setHelped] = useState(previous?.strategies?.helped ?? '');
  const [forConsultation, setForConsultation] = useState(previous?.forConsultation ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const loose = labels as unknown as (key: string) => string;
  const filled = t('filled');
  const optional = t('optional');
  const minutes = sleepMinutes(sleepFrom, sleepTo);

  async function handleSave() {
    if (mood === null) {
      setError(t('moodRequired'));
      return;
    }
    const written = new Date(writtenAt);
    const content: EntryContent = {
      v: 1,
      writtenAt: Number.isNaN(written.getTime()) ? new Date().toISOString() : written.toISOString(),
      reporter,
      mood,
      words,
      note: note.trim().slice(0, NOTE_MAX_LENGTH),
      forConsultation,
    };
    if (meta.blocks.aggression && aggression !== null) content.aggression = {level: aggression, targets: aggression > 0 ? targets : []};
    if (meta.blocks.intensities && Object.keys(intensities).length) content.intensities = intensities;
    if (meta.blocks.sleep && hasSleep) content.sleep = {from: sleepFrom, to: sleepTo, wakes, food};
    if (meta.blocks.medication && (Object.keys(doses).length || sideEffects.trim()))
      content.medication = {doses, sideEffects: sideEffects.trim().slice(0, SHORT_TEXT_MAX_LENGTH)};
    if (meta.blocks.events && (eventTags.length || eventText.trim())) content.events = {tags: eventTags, text: eventText.trim().slice(0, NOTE_MAX_LENGTH)};
    if (meta.blocks.strategies && (strategyTags.length || helped.trim()))
      content.strategies = {tags: strategyTags, helped: helped.trim().slice(0, SHORT_TEXT_MAX_LENGTH)};

    setIsBusy(true);
    setError(null);
    try {
      const entryId = entry?.id ?? crypto.randomUUID();
      const sealed = await sealEntry(details.id, diary.ring, details.keyVersion, entryId, content);
      await api.saveEntry(details.id, entryId, details.keyVersion, sealed);
      await onSaved();
    } catch (failure) {
      setError(errorMessage(failure));
      setIsBusy(false);
    }
  }

  const moodIsExtreme = mood !== null && Math.abs(mood) === 3;

  return (
    <main className={screen.screen}>
      <AppHeader />
      <button type="button" className={blocks.back} style={{border: 0, background: 'none', padding: 0, cursor: 'pointer'}} onClick={onClose}>
        {t('back')}
      </button>
      <h1 className={blocks.title}>{entry ? t('editTitle') : t('title')}</h1>

      <TextField label={t('when')} type="datetime-local" value={writtenAt} onChange={(event) => setWrittenAt(event.target.value)} />

      <Segmented
        label={t('reporter')}
        value={reporter}
        onChange={setReporter}
        options={[
          {value: 'observed', label: t('observed')},
          {value: 'self', label: t('self')},
        ]}
      />

      <LevelScale legend={t('mood')} legendHint={t('moodHint')} options={moodOptions} value={mood} onChange={setMood} />
      {moodIsExtreme && <CrisisNotice variant="risk" />}

      {meta.blocks.aggression && (
        <>
          <LevelScale legend={t('aggression')} legendHint={t('aggressionHint')} options={aggressionOptions} value={aggression} onChange={setAggression} />
          {aggression !== null && aggression > 0 && (
            <Chips
              label={t('targets')}
              options={aggressionTargets.map((target) => ({value: target, label: loose(`targets.${target}`)}))}
              selected={targets}
              onToggle={(value) => setTargets(toggle(targets, value) as AggressionTarget[])}
            />
          )}
          {targets.includes('self') && <CrisisNotice variant="self" />}
        </>
      )}

      <Chips label={t('words')} options={wordCodes.map((code) => ({value: code, label: loose(`words.${code}`)}))} selected={words} onToggle={(value) => setWords(toggle(words, value))} />

      <TextAreaField label={t('note')} placeholder={t('notePlaceholder')} rows={5} maxLength={NOTE_MAX_LENGTH} value={note} onChange={(event) => setNote(event.target.value)} />

      {meta.blocks.intensities && (
        <Block title={blockNames('intensities.title')} status={Object.keys(intensities).length ? filled : optional}>
          {intensityKeys.map((key) => (
            <div key={key} className={styles.inlineField}>
              <label htmlFor={`intensity-${key}`}>{loose(`intensities.${key}`)}</label>
              <select
                id={`intensity-${key}`}
                className={styles.select}
                value={intensities[key] ?? ''}
                onChange={(event) => {
                  const next = {...intensities};
                  if (event.target.value === '') delete next[key];
                  else next[key] = Number(event.target.value);
                  setIntensities(next);
                }}
              >
                <option value="">—</option>
                {Array.from({length: 11}, (_, value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <p className={blocks.muted}>{t('intensitiesHint')}</p>
        </Block>
      )}

      {meta.blocks.sleep && (
        <Block title={blockNames('sleep.title')} status={hasSleep ? filled : optional}>
          <Toggle checked={hasSleep} onChange={setHasSleep} title={t('recordSleep')} />
          {hasSleep && (
            <>
              <div className={blocks.timeRow}>
                <TextField label={t('sleptAt')} type="time" value={sleepFrom} onChange={(event) => setSleepFrom(event.target.value)} />
                <TextField label={t('wokeAt')} type="time" value={sleepTo} onChange={(event) => setSleepTo(event.target.value)} />
              </div>
              {minutes !== null && <p className={blocks.muted}>{t('sleptFor', {time: formatMinutes(minutes)})}</p>}
              <div className={styles.inlineField}>
                <label htmlFor="wakes">{t('wakes')}</label>
                <select id="wakes" className={styles.select} value={wakes} onChange={(event) => setWakes(Number(event.target.value))}>
                  {[0, 1, 2, 3, 4].map((value) => (
                    <option key={value} value={value}>
                      {value === 4 ? t('wakesMany') : value}
                    </option>
                  ))}
                </select>
              </div>
              <Segmented label={t('food')} value={food} onChange={setFood} options={foodLevels.map((level) => ({value: level, label: loose(`food.${level}`)}))} />
            </>
          )}
        </Block>
      )}

      {meta.blocks.medication && (
        <Block title={blockNames('medication.title')} status={Object.keys(doses).length || sideEffects ? filled : optional}>
          {meta.medicines.length === 0 && <p className={blocks.muted}>{t('noMedicines')}</p>}
          {meta.medicines.map((medicine) => (
            <div key={medicine.id} className={styles.medicine}>
              <div className={blocks.split}>
                <span className={blocks.listTitle}>{medicine.name}</span>
                {medicine.time && <span className={`${blocks.muted} ${blocks.mono}`}>{medicine.time}</span>}
              </div>
              <Segmented
                label={medicine.name}
                isLabelVisible={false}
                value={doses[medicine.id] ?? null}
                onChange={(state) => setDoses({...doses, [medicine.id]: state})}
                options={doseStates.map((state) => ({value: state, label: loose(`dose.${state}`)}))}
              />
            </div>
          ))}
          <TextField label={t('sideEffects')} placeholder={t('sideEffectsPlaceholder')} maxLength={SHORT_TEXT_MAX_LENGTH} value={sideEffects} onChange={(event) => setSideEffects(event.target.value)} />
        </Block>
      )}

      {meta.blocks.events && (
        <Block title={blockNames('events.title')} status={eventTags.length || eventText ? filled : optional}>
          <Chips label={t('eventTags')} options={eventCodes.map((code) => ({value: code, label: loose(`events.${code}`)}))} selected={eventTags} onToggle={(value) => setEventTags(toggle(eventTags, value))} />
          <TextAreaField label={t('eventText')} rows={2} maxLength={NOTE_MAX_LENGTH} value={eventText} onChange={(event) => setEventText(event.target.value)} />
        </Block>
      )}

      {meta.blocks.strategies && (
        <Block title={blockNames('strategies.title')} status={strategyTags.length || helped ? filled : optional}>
          <Chips
            label={t('strategyTags')}
            options={strategyCodes.map((code) => ({value: code, label: loose(`strategies.${code}`)}))}
            selected={strategyTags}
            onToggle={(value) => setStrategyTags(toggle(strategyTags, value))}
          />
          <TextField label={t('helped')} maxLength={SHORT_TEXT_MAX_LENGTH} value={helped} onChange={(event) => setHelped(event.target.value)} />
        </Block>
      )}

      <Toggle checked={forConsultation} onChange={setForConsultation} title={t('forConsultation')} />

      <span className={styles.lockLine}>
        <LockIcon />
        {t('encrypted')}
      </span>
      {error && (
        <p className={screen.formError} role="alert">
          {error}
        </p>
      )}
      <Button size="cta" isFullWidth isLoading={isBusy} onClick={() => void handleSave()}>
        {t('save')}
      </Button>
    </main>
  );
}
