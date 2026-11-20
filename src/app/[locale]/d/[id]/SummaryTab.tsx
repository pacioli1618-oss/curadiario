'use client';

import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {useFormatter, useLocale, useTranslations} from 'next-intl';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {Segmented} from '@/components/diary/Controls';
import styles from '@/components/diary/Diary.module.css';
import {useScaleLabels} from '@/components/diary/labels';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Stat} from '@/components/ui/Stat';
import {Toggle} from '@/components/ui/Toggle';
import {csvNumber, downloadCsv, fileSlug, toCsv, type CsvCell} from '@/lib/csv';
import {formatMinutes, formatMood, nearestMood, sleepMinutes, summarize, withinDays, type DatedEntry} from '@/lib/diary';
import type {OpenDiary} from './DiaryScreen';
import {useEntryDetails} from './EntriesTab';

const periods = ['7', '30', '90', 'all'] as const;
type Period = (typeof periods)[number];
type Parts = {numbers: boolean; entries: boolean; notes: boolean; questions: boolean};

export function SummaryTab({diary}: {diary: OpenDiary}) {
  const t = useTranslations('Summary');
  const {moodTitle} = useScaleLabels();
  const [period, setPeriod] = useState<Period>('30');
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [parts, setParts] = useState<Parts>({numbers: true, entries: true, notes: true, questions: true});
  const [isPrinting, setIsPrinting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const exportCsv = useCsvExport();

  const entries = period === 'all' ? diary.entries : withinDays(diary.entries, Number(period));
  const summary = summarize(entries);
  const chronological = [...entries].reverse().slice(-60);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  useEffect(() => {
    if (!isPrinting) return;
    document.body.classList.add('printing');
    const done = () => {
      document.body.classList.remove('printing');
      setIsPrinting(false);
    };
    window.addEventListener('afterprint', done, {once: true});
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('printing');
    };
  }, [isPrinting]);

  async function handleExport(mode: 'download' | 'share') {
    setMessage(null);
    if (format === 'pdf') {
      setIsPrinting(true);
      return;
    }
    const {fileName, content} = exportCsv(diary, entries, parts);
    if (mode === 'share') {
      const file = new File([content], fileName, {type: 'text/csv'});
      if (navigator.canShare?.({files: [file]})) {
        try {
          await navigator.share({files: [file], title: fileName});
          return;
        } catch {
          return; // cancelled
        }
      }
    }
    downloadCsv(fileName, content);
    setMessage(t('downloaded', {file: fileName}));
  }

  return (
    <>
      <Segmented label={t('period')} value={period} onChange={setPeriod} options={periods.map((value) => ({value, label: t(`periods.${value}`)}))} />

      <Card variant="large">
        <div className={screen.stack}>
          <div className={blocks.split}>
            <h2 className={screen.sectionTitle}>{t('chartTitle')}</h2>
            <span className={`${blocks.muted} ${blocks.mono}`}>−3 … +3</span>
          </div>
          {chronological.length === 0 ? (
            <p className={blocks.muted}>{t('noEntries')}</p>
          ) : (
            <MoodChart entries={chronological} label={t('chartLabel', {values: chronological.map((entry) => formatMood(entry.content.mood)).join(', ')})} />
          )}
        </div>
      </Card>

      <div className={blocks.stats}>
        <Stat
          value={summary.averageMood === null ? '—' : formatMood(Math.round(summary.averageMood * 10) / 10).replace('.', ',')}
          label={summary.averageMood === null ? t('averageMood') : `${t('averageMood')} · ${moodTitle(nearestMood(summary.averageMood))}`}
        />
        <Stat value={summary.averageSleepMinutes === null ? '—' : formatMinutes(Math.round(summary.averageSleepMinutes))} label={t('averageSleep', {count: summary.nightsWithSleep})} />
        <Stat value={String(summary.missedDoses)} label={t('missedDoses', {count: summary.recordedDoses})} />
        <Stat value={String(summary.aggressionDays)} label={t('aggressionDays', {level: summary.highestAggression})} />
        <Stat value={String(diary.topics.filter((topic) => !topic.content.done).length)} label={t('pendingQuestions')} />
      </div>

      <Card variant="large">
        <div className={screen.stack}>
          <h2 className={screen.sectionTitle}>{t('exportTitle')}</h2>
          <Segmented
            label={t('format')}
            value={format}
            onChange={setFormat}
            options={[
              {value: 'pdf', label: t('pdf')},
              {value: 'csv', label: t('csv')},
            ]}
          />
          <Toggle checked={parts.numbers} onChange={(checked) => setParts({...parts, numbers: checked})} title={t('partNumbers')} />
          <Toggle checked={parts.entries} onChange={(checked) => setParts({...parts, entries: checked})} title={t('partEntries')} />
          <Toggle checked={parts.notes} onChange={(checked) => setParts({...parts, notes: checked})} title={t('partNotes')} hint={t('partNotesHint')} />
          <Toggle checked={parts.questions} onChange={(checked) => setParts({...parts, questions: checked})} title={t('partQuestions')} />
          <p className={blocks.warning}>{t('unencrypted')}</p>
          <div className={blocks.choice}>
            <Button onClick={() => void handleExport('download')}>{format === 'pdf' ? t('print') : t('download')}</Button>
            {format === 'csv' && canShare && (
              <Button variant="secondary" onClick={() => void handleExport('share')}>
                {t('share')}
              </Button>
            )}
          </div>
          {format === 'pdf' && <p className={blocks.muted}>{t('pdfHint')}</p>}
          {message && (
            <p role="status" className={blocks.muted}>
              {message}
            </p>
          )}
        </div>
      </Card>

      {isPrinting && createPortal(<Report diary={diary} entries={entries} parts={parts} period={period} />, document.body)}
    </>
  );
}

function MoodChart({entries, label}: {entries: DatedEntry[]; label: string}) {
  const format = useFormatter();
  return (
    <div role="img" aria-label={label} className={styles.chart}>
      {entries.map((entry) => {
        const mood = entry.content.mood;
        return (
          <div key={entry.id} className={styles.chartColumn}>
            <div className={styles.chartUp}>{mood > 0 && <div className={styles.barUp} style={{height: mood * 18}} />}</div>
            <div className={styles.baseline} />
            <div className={styles.chartDown}>{mood < 0 && <div className={styles.barDown} style={{height: -mood * 18}} />}</div>
            <span className={styles.chartLabel}>{formatMood(mood)}</span>
            <span className={styles.chartLabel}>{format.dateTime(new Date(entry.content.writtenAt), {day: 'numeric'})}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The printed report: plain, black on white, one table. */
function Report({diary, entries, parts, period}: {diary: OpenDiary; entries: DatedEntry[]; parts: Parts; period: Period}) {
  const t = useTranslations('Summary');
  const format = useFormatter();
  const {moodTitle, aggressionTitle} = useScaleLabels();
  const details = useEntryDetails();
  const summary = summarize(entries);
  const questions = diary.topics.filter((topic) => !topic.content.done);

  return (
    <div className={styles.report}>
      <h1 style={{fontSize: '16pt', margin: 0}}>{diary.meta.name}</h1>
      <p style={{margin: '2pt 0 10pt'}}>
        {t('reportPeriod', {period: t(`periods.${period}`), date: format.dateTime(new Date(), {dateStyle: 'long'})})}
      </p>
      {parts.numbers && (
        <p>
          {t('reportNumbers', {
            count: summary.count,
            mood: summary.averageMood === null ? '—' : `${formatMood(Math.round(summary.averageMood * 10) / 10).replace('.', ',')} (${moodTitle(nearestMood(summary.averageMood))})`,
            sleep: summary.averageSleepMinutes === null ? '—' : formatMinutes(Math.round(summary.averageSleepMinutes)),
            missed: summary.missedDoses,
            aggression: summary.aggressionDays,
          })}
        </p>
      )}
      {parts.entries && (
        <table className={styles.reportTable}>
          <thead>
            <tr>
              <th>{t('colWhen')}</th>
              <th>{t('colMood')}</th>
              <th>{t('colAggression')}</th>
              <th>{t('colDetails')}</th>
            </tr>
          </thead>
          <tbody>
            {[...entries].reverse().map((entry) => (
              <tr key={entry.id}>
                <td>{format.dateTime(new Date(entry.content.writtenAt), {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</td>
                <td>
                  {formatMood(entry.content.mood)} {moodTitle(entry.content.mood)}
                </td>
                <td>{entry.content.aggression ? `${entry.content.aggression.level} ${aggressionTitle(entry.content.aggression.level)}` : '—'}</td>
                <td>
                  {details(entry, diary.meta)
                    .map((line) => `${line.key}: ${line.value}`)
                    .join(' · ')}
                  {parts.notes && entry.content.note ? <div style={{whiteSpace: 'pre-wrap'}}>{entry.content.note}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {parts.questions && questions.length > 0 && (
        <>
          <h2 style={{fontSize: '13pt', marginTop: '14pt'}}>{t('partQuestions')}</h2>
          <ul>
            {questions.map((topic) => (
              <li key={topic.id}>{topic.content.text}</li>
            ))}
          </ul>
        </>
      )}
      <p style={{marginTop: '14pt', fontSize: '9pt'}}>{t('reportFooter')}</p>
    </div>
  );
}

function useCsvExport() {
  const t = useTranslations('Summary');
  const locale = useLocale();
  const {moodTitle, aggressionTitle} = useScaleLabels();
  const details = useEntryDetails();

  return (diary: OpenDiary, entries: DatedEntry[], parts: Parts) => {
    const header: CsvCell[] = [t('colDate'), t('colTime'), t('colReporter'), t('colMoodValue'), t('colMood'), t('colAggressionValue'), t('colAggression'), t('colSleepHours'), t('colDetails')];
    if (parts.notes) header.push(t('colNote'));
    const rows: CsvCell[][] = [header];
    for (const entry of [...entries].reverse()) {
      const content = entry.content;
      const written = new Date(content.writtenAt);
      const minutes = content.sleep ? sleepMinutes(content.sleep.from, content.sleep.to) : null;
      const row: CsvCell[] = [
        written.toLocaleDateString(locale),
        written.toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'}),
        content.reporter === 'self' ? t('reporterSelf') : t('reporterObserved'),
        content.mood,
        moodTitle(content.mood),
        content.aggression?.level ?? null,
        content.aggression ? aggressionTitle(content.aggression.level) : null,
        minutes === null ? null : csvNumber(minutes / 60, locale),
        details(entry, diary.meta)
          .map((line) => `${line.key}: ${line.value}`)
          .join(' | '),
      ];
      if (parts.notes) row.push(content.note);
      rows.push(row);
    }
    if (parts.questions) {
      const questions = diary.topics.filter((topic) => !topic.content.done);
      if (questions.length) {
        rows.push([]);
        rows.push([t('partQuestions')]);
        for (const topic of questions) rows.push([topic.content.text]);
      }
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return {fileName: `${fileSlug(diary.meta.name)}-${stamp}.csv`, content: toCsv(rows)};
  };
}
