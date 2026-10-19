// Turns the Log tab's column A into period start dates.
//
// The sheet adapter converts real date cells to `YYYY-MM-DD` in the
// spreadsheet's timezone before calling this; everything else arrives as-is.
// Text that looks like a date (e.g. a pasted "2026-10-01") is accepted too.

import { parseISODate } from './dates';
import type { ISODate } from './types';

export function parseLogValues(
  values: unknown[],
  firstRow = 2,
): { dates: ISODate[]; warnings: string[] } {
  const dates: ISODate[] = [];
  const warnings: string[] = [];

  values.forEach((value, i) => {
    if (value === null || value === undefined) return;
    const text = typeof value === 'string' ? value.trim() : value;
    if (text === '') return;

    const date = typeof text === 'string' ? parseISODate(text) : null;
    if (date) {
      dates.push(date);
    } else {
      warnings.push(
        `Log row ${firstRow + i}: "${String(value)}" is not a date, so it was ignored. ` +
          'Enter a date like 2026-10-01.',
      );
    }
  });

  return { dates, warnings };
}
