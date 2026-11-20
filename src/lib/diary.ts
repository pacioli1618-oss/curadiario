// The diary's content, as the browser sees it after decrypting. Nothing here reaches the server
// in the clear: DiaryMeta, EntryContent and TopicContent are encrypted whole (src/lib/vault.ts).
//
// Each shape carries v: 1. When a field changes meaning, bump it and convert old versions in
// the read functions below, so diaries written years ago still open.

export const blockKeys = ['aggression', 'intensities', 'sleep', 'medication', 'events', 'strategies'] as const;
export type BlockKey = (typeof blockKeys)[number];

export type Medicine = {id: string; name: string; time: string};

export type DiaryMeta = {
  v: 1;
  name: string;
  blocks: Record<BlockKey, boolean>;
  medicines: Medicine[];
};

export const defaultBlocks: Record<BlockKey, boolean> = {
  aggression: true,
  intensities: false,
  sleep: true,
  medication: true,
  events: false,
  strategies: false,
};

// Mood: −3 (severe depression) … 0 (stable) … +3 (severe euphoria). Shown top to bottom, euphoria first.
export const moodValues = [3, 2, 1, 0, -1, -2, -3] as const;
export type Mood = (typeof moodValues)[number];

// Aggression: 0 (none) … 4 (physical), the most intense moment of the day.
export const aggressionValues = [0, 1, 2, 3, 4] as const;
export type AggressionLevel = (typeof aggressionValues)[number];
export const aggressionTargets = ['people', 'objects', 'self'] as const;
export type AggressionTarget = (typeof aggressionTargets)[number];

export const reporters = ['observed', 'self'] as const;
export type Reporter = (typeof reporters)[number];

export const intensityKeys = ['anxiety', 'irritability', 'sadness', 'energy'] as const;
export type IntensityKey = (typeof intensityKeys)[number];

export const foodLevels = ['little', 'normal', 'much'] as const;
export type FoodLevel = (typeof foodLevels)[number];

export const doseStates = ['taken', 'missed', 'late'] as const;
export type DoseState = (typeof doseStates)[number];

// Suggested chips. Stored as these codes; shown through messages (Entry.words.*, …).
export const wordCodes = ['calm', 'cheerful', 'tired', 'sad', 'anxious', 'irritated', 'agitated', 'confused'] as const;
export const eventCodes = ['argument', 'routineChange', 'visit', 'appointment', 'badNews', 'wentOut'] as const;
export const strategyCodes = ['isolation', 'impulsivity', 'breathing', 'walk', 'talk', 'music', 'askedForHelp'] as const;

export type EntryContent = {
  v: 1;
  /** When it happened, as the writer's device saw it (ISO). */
  writtenAt: string;
  reporter: Reporter;
  mood: Mood;
  aggression?: {level: AggressionLevel; targets: AggressionTarget[]};
  words: string[];
  note: string;
  intensities?: Partial<Record<IntensityKey, number>>;
  sleep?: {from: string; to: string; wakes: number; food: FoodLevel};
  medication?: {doses: Record<string, DoseState>; sideEffects: string};
  events?: {tags: string[]; text: string};
  strategies?: {tags: string[]; helped: string};
  forConsultation: boolean;
};

export type TopicContent = {v: 1; text: string; done: boolean; doneAt?: string};

export const NOTE_MAX_LENGTH = 4000;
export const SHORT_TEXT_MAX_LENGTH = 300;
export const NAME_MAX_LENGTH = 60;

// ---------------------------------------------------------------------------
// Reading what came out of decryption (never trust shape: old versions, other clients)
// ---------------------------------------------------------------------------

export function readMeta(value: unknown): DiaryMeta {
  const data = (value ?? {}) as Partial<DiaryMeta>;
  return {
    v: 1,
    name: typeof data.name === 'string' ? data.name : '',
    blocks: {...defaultBlocks, ...(data.blocks ?? {})},
    medicines: Array.isArray(data.medicines) ? data.medicines.filter((item) => item && typeof item.name === 'string') : [],
  };
}

export function readEntry(value: unknown): EntryContent | null {
  const data = value as Partial<EntryContent> | null;
  if (!data || data.v !== 1 || !moodValues.includes(data.mood as Mood)) return null;
  return {
    ...data,
    v: 1,
    writtenAt: typeof data.writtenAt === 'string' ? data.writtenAt : new Date(0).toISOString(),
    reporter: data.reporter === 'self' ? 'self' : 'observed',
    mood: data.mood as Mood,
    words: Array.isArray(data.words) ? data.words.filter((word) => typeof word === 'string') : [],
    note: typeof data.note === 'string' ? data.note : '',
    forConsultation: data.forConsultation === true,
  };
}

export function readTopic(value: unknown): TopicContent | null {
  const data = value as Partial<TopicContent> | null;
  if (!data || data.v !== 1 || typeof data.text !== 'string') return null;
  return {v: 1, text: data.text, done: data.done === true, doneAt: data.doneAt};
}

// ---------------------------------------------------------------------------
// Sleep and summaries
// ---------------------------------------------------------------------------

export function isTimeKey(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Minutes between going to bed and waking up; across midnight when needed. */
export function sleepMinutes(from: string, to: string): number | null {
  if (!isTimeKey(from) || !isTimeKey(to)) return null;
  const [fromHour, fromMinute] = from.split(':').map(Number);
  const [toHour, toMinute] = to.split(':').map(Number);
  let minutes = toHour * 60 + toMinute - (fromHour * 60 + fromMinute);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes;
}

/** 450 → "7h30". */
export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}

export type DatedEntry = {id: string; authorId: string | null; createdAt: string; content: EntryContent};

export type PeriodSummary = {
  count: number;
  averageMood: number | null;
  averageSleepMinutes: number | null;
  nightsWithSleep: number;
  missedDoses: number;
  recordedDoses: number;
  aggressionDays: number;
  highestAggression: number;
};

export function summarize(entries: DatedEntry[]): PeriodSummary {
  const sleeps = entries.map((entry) => entry.content.sleep).flatMap((sleep) => (sleep ? [sleepMinutes(sleep.from, sleep.to)] : []));
  const validSleeps = sleeps.filter((value): value is number => value !== null);
  let missedDoses = 0;
  let recordedDoses = 0;
  for (const entry of entries) {
    for (const state of Object.values(entry.content.medication?.doses ?? {})) {
      recordedDoses++;
      if (state === 'missed') missedDoses++;
    }
  }
  const aggressionLevels = entries.map((entry) => entry.content.aggression?.level ?? 0);
  return {
    count: entries.length,
    averageMood: entries.length ? entries.reduce((sum, entry) => sum + entry.content.mood, 0) / entries.length : null,
    averageSleepMinutes: validSleeps.length ? validSleeps.reduce((sum, value) => sum + value, 0) / validSleeps.length : null,
    nightsWithSleep: validSleeps.length,
    missedDoses,
    recordedDoses,
    aggressionDays: aggressionLevels.filter((level) => level > 0).length,
    highestAggression: Math.max(0, ...aggressionLevels),
  };
}

/** "+2", "0", "−1" (true minus sign). */
export function formatMood(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}

/** Rounded mood, for naming the band of an average. */
export function nearestMood(value: number): Mood {
  const rounded = Math.max(-3, Math.min(3, Math.round(value)));
  return rounded as Mood;
}

/** Entries written within the last `days` days, newest first. */
export function withinDays(entries: DatedEntry[], days: number, now = new Date()) {
  const from = now.getTime() - days * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => new Date(entry.content.writtenAt).getTime() >= from);
}
