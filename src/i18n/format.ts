import {useFormatter} from 'next-intl';

// Notebook dates ("2026-11-17") and months ("2026-11") are wall-clock values: formatted in UTC
// so no time-zone shift moves them a day. Only the language changes.

const atNoon = (date: string) => new Date(`${date}T12:00:00Z`);

/** "seg., 17 de nov." / "lun, 17 nov" / "Mon, Nov 17". */
export function useFormatDay() {
  const format = useFormatter();
  return (date: string, style: 'short' | 'long' = 'short') =>
    format.dateTime(atNoon(date), {weekday: style, day: 'numeric', month: style, timeZone: 'UTC'});
}

/** "Novembro de 2026" / "Noviembre de 2026" / "November 2026" (first letter capitalized, like a title). */
export function useFormatMonth() {
  const format = useFormatter();
  return (month: string) => {
    const text = format.dateTime(atNoon(`${month}-01`), {month: 'long', year: 'numeric', timeZone: 'UTC'});
    return text.charAt(0).toLocaleUpperCase() + text.slice(1);
  };
}

/** A real moment (notices, sent_at) as the reader's local time: "07:56". */
export function useFormatClock() {
  const format = useFormatter();
  return (iso: string) => format.dateTime(new Date(iso), {hour: '2-digit', minute: '2-digit'});
}

/** A real moment as a short date and time: "17/11, 07:56". */
export function useFormatMoment() {
  const format = useFormatter();
  return (iso: string) => format.dateTime(new Date(iso), {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
}

/** Money in the workplace's currency. */
export function useFormatMoney() {
  const format = useFormatter();
  return (value: number, currency: string) =>
    format.number(value, {style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: value % 1 === 0 ? 0 : 2});
}

/** 7.5 → "7h30"; 8 → "8h". Same in the three languages. */
export function formatHours(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const whole = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${whole}h${String(minutes).padStart(2, '0')}` : `${whole}h`;
}
