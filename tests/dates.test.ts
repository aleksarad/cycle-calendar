import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  compareDates,
  diffDays,
  exclusiveEnd,
  parseISODate,
} from '../src/core/dates';
import type { ISODate } from '../src/core/types';

const d = (s: string) => s as ISODate;

describe('parseISODate', () => {
  it('accepts valid calendar dates', () => {
    expect(parseISODate('2026-01-31')).toBe('2026-01-31');
    expect(parseISODate('2028-02-29')).toBe('2028-02-29');
  });

  it.each(['2026-02-29', '2026-13-01', '2026-04-31', '2026-1-5', '26-01-01', '', 'tomorrow'])(
    'rejects %j',
    (s) => {
      expect(parseISODate(s)).toBeNull();
    },
  );
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays(d('2026-01-31'), 1)).toBe('2026-02-01');
    expect(addDays(d('2026-12-30'), 5)).toBe('2027-01-04');
    expect(addDays(d('2026-03-01'), -1)).toBe('2026-02-28');
  });

  it('handles leap days', () => {
    expect(addDays(d('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addDays(d('2028-02-29'), 1)).toBe('2028-03-01');
  });
});

describe('diffDays', () => {
  it('counts whole days from a to b', () => {
    expect(diffDays(d('2026-01-01'), d('2026-01-29'))).toBe(28);
    expect(diffDays(d('2026-01-29'), d('2026-01-01'))).toBe(-28);
    expect(diffDays(d('2026-12-20'), d('2027-01-17'))).toBe(28);
  });
});

// vitest.config.ts runs these in America/New_York and Australia/Sydney so any
// accidental dependence on local time shows up as an off-by-one day.
describe('DST transitions', () => {
  it('runs in a timezone that observes DST', () => {
    const winter = new Date(2026, 0, 15).getTimezoneOffset();
    const summer = new Date(2026, 6, 15).getTimezoneOffset();
    expect(winter).not.toBe(summer);
  });

  it('runs ahead of UTC in at least one project (catches local-midnight bugs)', () => {
    const offsets = [new Date(2026, 0, 15), new Date(2026, 6, 15)].map((x) =>
      x.getTimezoneOffset(),
    );
    const tz = process.env.TZ;
    if (tz === 'Australia/Sydney') expect(Math.max(...offsets)).toBeLessThan(0);
    if (tz === 'America/New_York') expect(Math.min(...offsets)).toBeGreaterThan(0);
    expect(['America/New_York', 'Australia/Sydney']).toContain(tz);
  });

  it('Australian transitions (2026-04-05, 2026-10-04) are still one day', () => {
    expect(addDays(d('2026-04-04'), 2)).toBe('2026-04-06');
    expect(addDays(d('2026-10-03'), 2)).toBe('2026-10-05');
    expect(diffDays(d('2026-09-20'), d('2026-10-18'))).toBe(28);
  });

  it('spring forward (2026-03-08 US) is still one day', () => {
    expect(addDays(d('2026-03-07'), 1)).toBe('2026-03-08');
    expect(addDays(d('2026-03-08'), 1)).toBe('2026-03-09');
    expect(diffDays(d('2026-03-01'), d('2026-03-29'))).toBe(28);
  });

  it('fall back (2026-11-01 US) is still one day', () => {
    expect(addDays(d('2026-10-31'), 1)).toBe('2026-11-01');
    expect(addDays(d('2026-11-01'), 1)).toBe('2026-11-02');
    expect(diffDays(d('2026-10-20'), d('2026-11-17'))).toBe(28);
  });

  it('EU transition dates (2026-03-29, 2026-10-25) are still one day', () => {
    expect(addDays(d('2026-03-28'), 2)).toBe('2026-03-30');
    expect(addDays(d('2026-10-24'), 2)).toBe('2026-10-26');
  });
});

describe('addMonths', () => {
  it('adds calendar months', () => {
    expect(addMonths(d('2026-01-15'), 6)).toBe('2026-07-15');
    expect(addMonths(d('2026-10-18'), 6)).toBe('2027-04-18');
  });

  it('clamps to the end of shorter months', () => {
    expect(addMonths(d('2026-08-31'), 6)).toBe('2027-02-28');
    expect(addMonths(d('2027-08-31'), 6)).toBe('2028-02-29');
    expect(addMonths(d('2026-01-31'), 3)).toBe('2026-04-30');
  });
});

describe('exclusiveEnd', () => {
  it('is the day after the last day, for the Calendar API', () => {
    expect(exclusiveEnd(d('2026-01-05'))).toBe('2026-01-06');
    expect(exclusiveEnd(d('2026-12-31'))).toBe('2027-01-01');
  });
});

describe('compareDates', () => {
  it('orders dates', () => {
    expect(compareDates(d('2026-01-01'), d('2026-01-02'))).toBeLessThan(0);
    expect(compareDates(d('2026-01-02'), d('2026-01-01'))).toBeGreaterThan(0);
    expect(compareDates(d('2026-01-01'), d('2026-01-01'))).toBe(0);
  });
});
