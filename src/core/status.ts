// Rows for the Status tab: a two-column label/value table the adapter writes as-is.

import { IRREGULAR_RANGE, type Schedule } from './cycle';
import { diffDays } from './dates';
import type { CycleStats, ISODate, Settings } from './types';

export type SyncResult = { ok: true; eventsCreated?: number } | { ok: false; error: string };

export interface StatusInput {
  /** Null when sync failed before predictions could be computed. */
  schedule: Schedule | null;
  settings: Settings;
  /** Warnings from reading the Log and Settings tabs. */
  inputWarnings: string[];
  today: ISODate;
  /** Already formatted in the spreadsheet's timezone, e.g. "2026-10-18 14:02". */
  syncedAt: string;
  result: SyncResult;
}

export const STATUS_NOTE = 'Written by Cycle Calendar on every sync. Edits here are overwritten.';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A label on the first row of a list, blank labels after; "None" if empty. */
function list(label: string, items: string[]): string[][] {
  return items.length ? items.map((item, i) => [i === 0 ? label : '', item]) : [[label, 'None']];
}

function syncLine({ syncedAt, result }: StatusInput): string {
  if (!result.ok) return `${syncedAt}: Error: ${result.error}`;
  const created =
    result.eventsCreated === undefined ? '' : ` (${plural(result.eventsCreated, 'event')})`;
  return `${syncedAt}: Success${created}`;
}

function typicalLine({ typicalLength, basedOn }: CycleStats): string {
  if (basedOn === 0) {
    return `${typicalLength} days (the default; log at least 2 period starts to personalize)`;
  }
  if (basedOn === 1) return `${typicalLength} days, from your last cycle`;
  return `${typicalLength} days, the median of your last ${basedOn} cycles`;
}

function rangeLine({ shortest, longest, irregular }: CycleStats): string {
  if (shortest === undefined || longest === undefined) {
    return 'Not enough cycles yet (needs 3 logged period starts)';
  }
  const range = `${shortest}–${longest} days`;
  return irregular
    ? `${range}. Your cycles vary by more than ${IRREGULAR_RANGE} days, so predicted dates are less certain.`
    : range;
}

export function buildStatusRows(input: StatusInput): string[][] {
  const { schedule, settings, today } = input;
  const rows: string[][] = [
    ['Cycle Calendar', STATUS_NOTE],
    ['Last sync', syncLine(input)],
  ];

  if (schedule) {
    const { stats, nextPredictedStart } = schedule;
    const now = schedule.today;
    rows.push(
      [
        'Today',
        now
          ? `${today}: day ${now.cycleDay} of ${now.cycleLength}, ${settings.titles[now.phase]} (estimated)`
          : `${today}: no estimate yet`,
      ],
      [
        'Next predicted period',
        nextPredictedStart
          ? `${nextPredictedStart} (in ${plural(diffDays(today, nextPredictedStart), 'day')})`
          : 'No prediction yet',
      ],
      ['Typical cycle length', typicalLine(stats)],
      ['Cycle range', rangeLine(stats)],
      ...list(
        'Excluded intervals',
        stats.intervals
          .filter((i) => i.excludedReason)
          .map((i) => `${i.from} → ${i.to}: ${i.excludedReason}`),
      ),
    );
  }

  rows.push(...list('Warnings', [...input.inputWarnings, ...(schedule?.warnings ?? [])]));
  return rows;
}
