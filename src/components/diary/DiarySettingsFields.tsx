'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {TextField} from '@/components/ui/TextField';
import {Toggle} from '@/components/ui/Toggle';
import {blockKeys, isTimeKey, SHORT_TEXT_MAX_LENGTH, type BlockKey, type Medicine} from '@/lib/diary';

/** Which optional blocks this diary records. Mood, words, note and questions are always on. */
export function BlockToggles({value, onChange}: {value: Record<BlockKey, boolean>; onChange: (value: Record<BlockKey, boolean>) => void}) {
  const t = useTranslations('Blocks');
  return (
    <section className={screen.section} aria-labelledby="blocks-title">
      <h2 id="blocks-title" className={screen.sectionTitle}>
        {t('title')}
      </h2>
      <p className={screen.sectionHint}>{t('always')}</p>
      {blockKeys.map((key) => (
        <Toggle key={key} checked={value[key]} onChange={(checked) => onChange({...value, [key]: checked})} title={t(`${key}.title`)} hint={t(`${key}.hint`)} />
      ))}
    </section>
  );
}

/** Medicines in use: name with dose, and the usual time. Recorded, never reminded. */
export function MedicinesEditor({value, onChange}: {value: Medicine[]; onChange: (value: Medicine[]) => void}) {
  const t = useTranslations('Medicines');
  const [name, setName] = useState('');
  const [time, setTime] = useState('08:00');

  function handleAdd() {
    if (!name.trim()) return;
    onChange([...value, {id: crypto.randomUUID(), name: name.trim(), time: isTimeKey(time) ? time : ''}]);
    setName('');
  }

  return (
    <Card variant="large">
      <div className={screen.stack}>
        <h2 className={screen.sectionTitle}>{t('title')}</h2>
        {value.length === 0 && <p className={blocks.muted}>{t('empty')}</p>}
        <ul className={blocks.list}>
          {value.map((medicine) => (
            <li key={medicine.id} className={blocks.listItem} style={{paddingLeft: 0, paddingRight: 0}}>
              <span className={blocks.listMain}>
                <span className={blocks.listTitle}>{medicine.name}</span>
                {medicine.time && <span className={`${blocks.muted} ${blocks.mono}`}>{medicine.time}</span>}
              </span>
              <Button variant="ghost" onClick={() => onChange(value.filter((item) => item.id !== medicine.id))} aria-label={t('remove', {name: medicine.name})}>
                {t('removeShort')}
              </Button>
            </li>
          ))}
        </ul>
        <div className={blocks.timeRow} style={{gridTemplateColumns: 'minmax(0, 1fr) 110px'}}>
          <TextField label={t('nameLabel')} placeholder={t('namePlaceholder')} value={name} maxLength={SHORT_TEXT_MAX_LENGTH} onChange={(event) => setName(event.target.value)} />
          <TextField label={t('timeLabel')} type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </div>
        <Button variant="secondary" onClick={handleAdd} disabled={!name.trim()}>
          {t('add')}
        </Button>
        <p className={blocks.muted}>{t('notReminder')}</p>
      </div>
    </Card>
  );
}
