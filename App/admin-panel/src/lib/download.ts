// Export helpers: turn rows into CSV / JSON and let the browser download them.
// Files are created in the browser — nothing is uploaded anywhere.

/** One CSV cell: quote it if it contains a separator, quote or line break. */
function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV with semicolons, because Norwegian Excel expects ";" (comma is the
 * decimal separator). Numbers are written with a decimal comma for the same reason.
 */
export function toCsv<T>(rows: T[], columns: { header: string; value: (row: T) => unknown }[]): string {
  const format = (v: unknown) => (typeof v === 'number' ? String(Math.round(v * 10) / 10).replace('.', ',') : v);
  const lines = [columns.map((c) => cell(c.header)).join(';')];
  for (const row of rows) lines.push(columns.map((c) => cell(format(c.value(row)))).join(';'));
  return lines.join('\r\n');
}

/** Start a download of `content` as a file. The BOM makes Excel read æøå correctly. */
export function downloadFile(filename: string, content: string, type: 'csv' | 'json') {
  const mime = type === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
  const blob = new Blob([type === 'csv' ? '﻿' + content : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** "filiped" → "filiped", "Øyvind B." → "oyvind-b" — safe for file names. */
export function fileSafe(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
