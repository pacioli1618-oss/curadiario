// Spreadsheet export. Framework-free and unit-tested.
//
// CSV with ";" between columns and a UTF-8 BOM: Excel and LibreOffice in Portuguese
// open it straight into columns with accents intact; Google Sheets imports it too.

export type CsvCell = string | number | null | undefined;

function escapeCell(cell: CsvCell) {
  if (cell === null || cell === undefined) return '';
  const text = String(cell);
  // Formula injection: a cell starting with = + - @ would run as a formula when opened.
  const safe = /^[=+\-@\t\r]/.test(text) && typeof cell !== 'number' ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: CsvCell[][]) {
  return '﻿' + rows.map((row) => row.map(escapeCell).join(';')).join('\r\n') + '\r\n';
}

/** Numbers with the reader's decimal comma, so the spreadsheet reads them as numbers. */
export function csvNumber(value: number | null, locale: string) {
  if (value === null) return '';
  return new Intl.NumberFormat(locale, {useGrouping: false, maximumFractionDigits: 2}).format(value);
}

/** Saves the text as a file (browser only). */
export function downloadCsv(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], {type: 'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Padaria Central" → "padaria-central", for file names. */
export function fileSlug(text: string) {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'curadiario'
  );
}
