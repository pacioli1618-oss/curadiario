import assert from 'node:assert/strict';
import {test} from 'node:test';
import {formatMinutes, formatMood, nearestMood, readEntry, readMeta, sleepMinutes, summarize, withinDays, type DatedEntry, type EntryContent} from '../src/lib/diary';

const entry = (content: Partial<EntryContent>, writtenAt = '2026-11-19T21:00:00Z'): DatedEntry => ({
  id: crypto.randomUUID(),
  authorId: null,
  createdAt: writtenAt,
  content: {v: 1, writtenAt, reporter: 'observed', mood: 0, words: [], note: '', forConsultation: false, ...content},
});

test('sleep crosses midnight', () => {
  assert.equal(sleepMinutes('23:30', '06:30'), 7 * 60);
  assert.equal(sleepMinutes('13:00', '15:15'), 135);
  assert.equal(sleepMinutes('25:00', '06:00'), null);
  assert.equal(formatMinutes(450), '7h30');
  assert.equal(formatMinutes(480), '8h');
});

test('mood formatting uses a real minus sign', () => {
  assert.equal(formatMood(2), '+2');
  assert.equal(formatMood(-1), '−1');
  assert.equal(formatMood(0), '0');
  assert.equal(nearestMood(-2.6), -3);
  assert.equal(nearestMood(9), 3);
});

test('summary counts doses, sleep and aggression', () => {
  const summary = summarize([
    entry({mood: 2, sleep: {from: '00:10', to: '06:00', wakes: 3, food: 'little'}, medication: {doses: {a: 'taken', b: 'missed'}, sideEffects: ''}, aggression: {level: 2, targets: ['people']}}),
    entry({mood: -1, sleep: {from: '23:30', to: '06:30', wakes: 2, food: 'normal'}, medication: {doses: {a: 'late', b: 'taken'}, sideEffects: ''}}),
  ]);
  assert.equal(summary.count, 2);
  assert.equal(summary.averageMood, 0.5);
  assert.equal(summary.averageSleepMinutes, (350 + 420) / 2);
  assert.equal(summary.missedDoses, 1);
  assert.equal(summary.recordedDoses, 4);
  assert.equal(summary.aggressionDays, 1);
  assert.equal(summary.highestAggression, 2);
  assert.equal(summarize([]).averageMood, null);
});

test('decrypted content is checked before use', () => {
  assert.equal(readEntry({v: 1, mood: 7}), null);
  assert.equal(readEntry({v: 2, mood: 1}), null);
  const read = readEntry({v: 1, mood: -3, words: ['sad', 3], note: 5});
  assert.ok(read);
  assert.deepEqual(read.words, ['sad']);
  assert.equal(read.note, '');
  assert.equal(read.reporter, 'observed');
  const meta = readMeta({name: 'Vô João', blocks: {events: true}});
  assert.equal(meta.blocks.events, true);
  assert.equal(meta.blocks.sleep, true);
  assert.deepEqual(meta.medicines, []);
});

test('period filter', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  const list = [entry({}, '2026-11-19T12:00:00Z'), entry({}, '2026-10-01T12:00:00Z')];
  assert.equal(withinDays(list, 7, now).length, 1);
  assert.equal(withinDays(list, 90, now).length, 2);
});
