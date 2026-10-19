import { describe, expect, it } from 'vitest';
import { buildSchedule, computeStats, phaseBoundaries } from '../src/core/cycle';
import { addDays, diffDays } from '../src/core/dates';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import type { ISODate, PhaseDays, PhaseSpan, Settings } from '../src/core/types';

const d = (s: string) => s as ISODate;
const dates = (...s: string[]) => s.map(d);

/** Start dates `gaps` days apart, beginning at `first`. */
function startsWithGaps(first: string, gaps: number[]): ISODate[] {
  const out = [d(first)];
  for (const gap of gaps) out.push(addDays(out[out.length - 1]!, gap));
  return out;
}

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});

/** Compact [phase, startDay, endDay] tuples for readable expectations. */
const days = (phases: PhaseDays[]) => phases.map((p) => [p.phase, p.startDay, p.endDay]);

describe('computeStats', () => {
  it('averages the most recent N intervals of a regular log', () => {
    const starts = startsWithGaps('2026-01-01', [35, 35, 28, 28, 28, 28, 28, 28]);
    const stats = computeStats(starts, settings({ cyclesToAverage: 6 }));
    expect(stats.averageLength).toBe(28);
    expect(stats.basedOn).toBe(6);
  });

  it('uses all intervals when there are fewer than N', () => {
    const stats = computeStats(startsWithGaps('2026-01-01', [29, 31, 30]), settings());
    expect(stats.averageLength).toBe(30);
    expect(stats.basedOn).toBe(3);
  });

  it('works from exactly two starts', () => {
    const stats = computeStats(dates('2026-01-01', '2026-01-31'), settings());
    expect(stats.averageLength).toBe(30);
    expect(stats.basedOn).toBe(1);
  });

  it('rounds the average to the nearest whole day', () => {
    expect(computeStats(startsWithGaps('2026-01-01', [28, 29]), settings()).averageLength).toBe(29);
    expect(computeStats(startsWithGaps('2026-01-01', [28, 28, 29]), settings()).averageLength).toBe(
      28,
    );
  });

  it.each([[[]], [['2026-01-01']]])('falls back to the default cycle length with %j', (s) => {
    const stats = computeStats(dates(...s), settings({ defaultCycleLength: 32 }));
    expect(stats.averageLength).toBe(32);
    expect(stats.basedOn).toBe(0);
  });

  it('excludes outlier intervals and says why', () => {
    const starts = startsWithGaps('2026-01-01', [14, 28, 60, 28]);
    const stats = computeStats(starts, settings());
    expect(stats.averageLength).toBe(28);
    expect(stats.basedOn).toBe(2);

    const excluded = stats.intervals.filter((i) => i.excludedReason);
    expect(excluded.map((i) => i.days)).toEqual([14, 60]);
    expect(excluded[0]!.excludedReason).toMatch(/shorter than 21/);
    expect(excluded[1]!.excludedReason).toMatch(/longer than 45/);
  });

  it('keeps intervals of exactly 21 and 45 days', () => {
    const stats = computeStats(startsWithGaps('2026-01-01', [21, 45]), settings());
    expect(stats.basedOn).toBe(2);
    expect(stats.averageLength).toBe(33);
  });

  it('falls back to the default when every interval is an outlier', () => {
    const stats = computeStats(startsWithGaps('2026-01-01', [10, 90]), settings());
    expect(stats.averageLength).toBe(28);
    expect(stats.basedOn).toBe(0);
  });

  it('handles unsorted and duplicate dates', () => {
    const messy = dates('2026-03-26', '2026-01-01', '2026-02-26', '2026-01-29', '2026-02-26');
    const stats = computeStats(messy, settings());
    expect(stats.starts).toEqual(dates('2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'));
    expect(stats.averageLength).toBe(28);
    expect(stats.basedOn).toBe(3);
  });
});

describe('phaseBoundaries', () => {
  it.each([
    [
      21,
      [
        ['menstrual', 1, 5],
        ['ovulatory', 6, 8],
        ['luteal', 9, 21],
      ],
    ],
    [
      28,
      [
        ['menstrual', 1, 5],
        ['follicular', 6, 12],
        ['ovulatory', 13, 15],
        ['luteal', 16, 28],
      ],
    ],
    [
      35,
      [
        ['menstrual', 1, 5],
        ['follicular', 6, 19],
        ['ovulatory', 20, 22],
        ['luteal', 23, 35],
      ],
    ],
    [
      45,
      [
        ['menstrual', 1, 5],
        ['follicular', 6, 29],
        ['ovulatory', 30, 32],
        ['luteal', 33, 45],
      ],
    ],
  ])('anchors ovulation on the luteal phase for a %i-day cycle', (length, expected) => {
    const { phases, warning } = phaseBoundaries(length, 5, 14);
    expect(days(phases)).toEqual(expected);
    expect(warning).toBeUndefined();
  });

  it('starts ovulatory the day after a long period when follicular has no room', () => {
    const { phases, warning } = phaseBoundaries(21, 7, 14);
    expect(days(phases)).toEqual([
      ['menstrual', 1, 7],
      ['ovulatory', 8, 8],
      ['luteal', 9, 21],
    ]);
    expect(warning).toBeUndefined();
  });

  it('falls back to menstrual + luteal with a warning when ovulatory cannot fit', () => {
    const { phases, warning } = phaseBoundaries(21, 10, 14);
    expect(days(phases)).toEqual([
      ['menstrual', 1, 10],
      ['luteal', 11, 21],
    ]);
    expect(warning).toMatch(/period length/i);
  });

  it('never overlaps, leaves gaps, or produces empty phases for any valid settings', () => {
    for (let length = 21; length <= 45; length++) {
      for (let period = 1; period <= 10; period++) {
        for (let luteal = 10; luteal <= 16; luteal++) {
          const { phases } = phaseBoundaries(length, period, luteal);
          const label = `L=${length} P=${period} luteal=${luteal}`;
          expect(phases[0]!.startDay, label).toBe(1);
          expect(phases[phases.length - 1]!.endDay, label).toBe(length);
          for (const [i, p] of phases.entries()) {
            expect(p.endDay, label).toBeGreaterThanOrEqual(p.startDay);
            if (i > 0) expect(p.startDay, label).toBe(phases[i - 1]!.endDay + 1);
          }
        }
      }
    }
  });
});

/** Every span starts the day after the previous one ends: no overlaps, no gaps. */
function expectContiguous(spans: PhaseSpan[]) {
  for (let i = 1; i < spans.length; i++) {
    expect(spans[i]!.start, `span ${i}`).toBe(addDays(spans[i - 1]!.end, 1));
  }
}

describe('buildSchedule', () => {
  const today = d('2026-10-18');

  it('places the current cycle on the latest start and predicts ahead', () => {
    const schedule = buildSchedule(dates('2026-09-01', '2026-09-29'), settings(), today);

    expect(schedule.spans.slice(0, 4).map((s) => [s.phase, s.start, s.end, s.predicted])).toEqual([
      ['menstrual', '2026-09-29', '2026-10-03', false],
      ['follicular', '2026-10-04', '2026-10-10', false],
      ['ovulatory', '2026-10-11', '2026-10-13', false],
      ['luteal', '2026-10-14', '2026-10-26', false],
    ]);
    expect(schedule.spans[4]).toMatchObject({ phase: 'menstrual', start: '2026-10-27' });
    expect(schedule.spans.slice(4).every((s) => s.predicted)).toBe(true);
    expectContiguous(schedule.spans);

    expect(schedule.today).toEqual({ phase: 'luteal', cycleDay: 20, cycleLength: 28 });
    expect(schedule.nextPredictedStart).toBe('2026-10-27');
    expect(schedule.lateByDays).toBe(0);
    expect(schedule.warnings).toEqual([]);
  });

  it('covers the window: the last cycle starts on or before today + months ahead', () => {
    const { spans } = buildSchedule(dates('2026-09-01', '2026-09-29'), settings(), today);
    const windowEnd = d('2027-04-18');
    const lastCycleStart = spans[spans.length - 1]!.cycleStart;
    expect(lastCycleStart <= windowEnd).toBe(true);
    expect(addDays(lastCycleStart, 28) > windowEnd).toBe(true);
    expect(spans[spans.length - 1]!.phase).toBe('luteal');
  });

  it('uses the default cycle length from a single start', () => {
    const schedule = buildSchedule(dates('2026-10-10'), settings(), today);
    expect(schedule.stats.basedOn).toBe(0);
    expect(schedule.spans[0]).toMatchObject({ cycleLength: 28, start: '2026-10-10' });
    expect(schedule.nextPredictedStart).toBe('2026-11-07');
  });

  it('renders nothing and asks for a date when the log is empty', () => {
    const schedule = buildSchedule([], settings(), today);
    expect(schedule.spans).toEqual([]);
    expect(schedule.today).toBeNull();
    expect(schedule.warnings.join()).toMatch(/log/i);
  });

  it('is not late on the predicted start day itself', () => {
    const schedule = buildSchedule(dates('2026-09-20'), settings(), d('2026-10-18'));
    expect(schedule.lateByDays).toBe(0);
    expect(schedule.today).toMatchObject({ phase: 'menstrual', cycleDay: 1 });
  });

  it('keeps predicting from predicted dates when a period is late', () => {
    const schedule = buildSchedule(dates('2026-08-01', '2026-08-29'), settings(), today);
    expect(schedule.lateByDays).toBe(22);
    expect(schedule.warnings.join()).toMatch(/late.*2026-09-26/i);

    // The cycle containing today was predicted to start 2026-09-26.
    expect(schedule.today).toEqual({ phase: 'luteal', cycleDay: 23, cycleLength: 28 });
    expect(schedule.nextPredictedStart).toBe('2026-10-24');
    expect(schedule.spans[0]).toMatchObject({ start: '2026-08-29', predicted: false });
    expectContiguous(schedule.spans);
  });

  it('skips past predicted cycles when the last log is long ago', () => {
    const schedule = buildSchedule(dates('2025-01-01'), settings(), today);
    const predicted = schedule.spans.filter((s) => s.predicted);
    const firstPredictedCycle = predicted[0]!.cycleStart;
    expect(addDays(firstPredictedCycle, 27) >= today).toBe(true);
    expect(firstPredictedCycle <= today).toBe(true);
    expect(schedule.spans.filter((s) => !s.predicted)).toHaveLength(4);
    expect(schedule.spans.length).toBeLessThan(50);
  });

  it('ignores start dates after today and warns', () => {
    const schedule = buildSchedule(dates('2026-09-29', '2027-01-01'), settings(), today);
    expect(schedule.stats.starts).toEqual(dates('2026-09-29'));
    expect(schedule.spans[0]!.start).toBe('2026-09-29');
    expect(schedule.warnings.join()).toMatch(/2027-01-01.*future/);
  });

  it('reports a phase-fit warning once, not per cycle', () => {
    const schedule = buildSchedule(
      dates('2026-09-01', '2026-09-22'),
      settings({ periodLength: 10 }),
      today,
    );
    expect(schedule.spans.some((s) => s.phase === 'ovulatory')).toBe(false);
    expect(schedule.warnings.filter((w) => /period length/i.test(w))).toHaveLength(1);
  });

  it('crosses a year boundary cleanly', () => {
    const schedule = buildSchedule(dates('2026-12-20'), settings(), d('2026-12-25'));
    expect(schedule.spans.find((s) => s.cycleIndex === 1)!.start).toBe('2027-01-17');
    expectContiguous(schedule.spans);
    for (const s of schedule.spans) expect(diffDays(s.start, s.end)).toBe(s.endDay - s.startDay);
  });
});
