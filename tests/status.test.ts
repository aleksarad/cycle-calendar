import { describe, expect, it } from 'vitest';
import { buildSchedule } from '../src/core/cycle';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { buildStatusRows, type StatusInput } from '../src/core/status';
import type { ISODate } from '../src/core/types';

const today = '2026-10-18' as ISODate;
const scheduleFrom = (...starts: string[]) =>
  buildSchedule(starts as ISODate[], DEFAULT_SETTINGS, today);

const input = (overrides: Partial<StatusInput> = {}): StatusInput => ({
  schedule: scheduleFrom('2026-09-01', '2026-09-29'),
  settings: DEFAULT_SETTINGS,
  inputWarnings: [],
  today,
  syncedAt: '2026-10-18 14:02',
  result: { ok: true, eventsCreated: 32 },
  ...overrides,
});

/** Rows as a label → value map, for labels that appear once. */
const byLabel = (rows: string[][]) => Object.fromEntries(rows.filter(([l]) => l));

describe('buildStatusRows', () => {
  it('summarizes a successful sync', () => {
    expect(buildStatusRows(input())).toEqual([
      ['Cycle Calendar', expect.stringContaining('overwritten')],
      ['Last sync', '2026-10-18 14:02: Success (32 events)'],
      ['Today', '2026-10-18: day 20 of 28, 🌘 Luteal (estimated)'],
      ['Next predicted period', '2026-10-27 (in 9 days)'],
      ['Average cycle length', '28 days, from your last 1 cycle'],
      ['Excluded intervals', 'None'],
      ['Warnings', 'None'],
    ]);
  });

  it('every row has exactly two cells', () => {
    for (const row of buildStatusRows(input())) expect(row).toHaveLength(2);
  });

  it('lists excluded intervals and their reasons', () => {
    const rows = buildStatusRows(
      input({ schedule: scheduleFrom('2026-06-01', '2026-06-15', '2026-07-13', '2026-09-29') }),
    );
    const start = rows.findIndex(([l]) => l === 'Excluded intervals');
    expect(rows[start]![1]).toMatch(/^2026-06-01 → 2026-06-15: 14 days is shorter/);
    expect(rows[start + 1]).toEqual(['', expect.stringMatching(/^2026-07-13 → 2026-09-29: 78/)]);
  });

  it('marks the default cycle length when there is too little data', () => {
    expect(byLabel(buildStatusRows(input({ schedule: scheduleFrom('2026-10-10') })))).toMatchObject(
      { 'Average cycle length': expect.stringContaining('the default') },
    );
  });

  it('combines input warnings with schedule warnings', () => {
    const rows = buildStatusRows(
      input({
        schedule: scheduleFrom('2026-08-01', '2026-08-29'),
        inputWarnings: ['Log row 4: "x" is not a date, so it was ignored.'],
      }),
    );
    const start = rows.findIndex(([l]) => l === 'Warnings');
    expect(rows.slice(start).map(([, v]) => v)).toEqual([
      'Log row 4: "x" is not a date, so it was ignored.',
      expect.stringMatching(/may be late/),
    ]);
  });

  it('reports an error even when no schedule could be computed', () => {
    const rows = buildStatusRows(
      input({ schedule: null, result: { ok: false, error: 'Calendar quota exceeded' } }),
    );
    expect(byLabel(rows)['Last sync']).toBe('2026-10-18 14:02: Error: Calendar quota exceeded');
    expect(rows.map(([l]) => l)).not.toContain('Today');
  });

  it('omits the event count when none is given', () => {
    const rows = buildStatusRows(input({ result: { ok: true } }));
    expect(byLabel(rows)['Last sync']).toBe('2026-10-18 14:02: Success');
  });
});
