// Cycle statistics and the phase schedule. Pure functions over ISODate strings.

import { addDays, addMonths, compareDates, diffDays } from './dates';
import type {
  CycleStats,
  ISODate,
  Interval,
  PhaseDays,
  PhaseName,
  PhaseSpan,
  Settings,
} from './types';

/** Intervals outside this range are likely a missed or extra log, so they're left out of the average. */
export const MIN_INTERVAL = 21;
export const MAX_INTERVAL = 45;

export function computeStats(starts: ISODate[], settings: Settings): CycleStats {
  const unique = [...new Set(starts)].sort(compareDates);

  const intervals: Interval[] = [];
  for (let i = 1; i < unique.length; i++) {
    const from = unique[i - 1]!;
    const to = unique[i]!;
    const days = diffDays(from, to);
    const interval: Interval = { from, to, days };
    if (days < MIN_INTERVAL) {
      interval.excludedReason = `${days} days is shorter than ${MIN_INTERVAL} (possibly an extra or mistyped date)`;
    } else if (days > MAX_INTERVAL) {
      interval.excludedReason = `${days} days is longer than ${MAX_INTERVAL} (possibly a missed log)`;
    }
    intervals.push(interval);
  }

  const used = intervals
    .filter((i) => !i.excludedReason)
    .slice(-settings.cyclesToAverage)
    .map((i) => i.days);

  const averageLength = used.length
    ? Math.round(used.reduce((sum, n) => sum + n, 0) / used.length)
    : settings.defaultCycleLength;

  return { starts: unique, intervals, averageLength, basedOn: used.length };
}

/**
 * Display phases for one cycle of `length` days, anchored on the luteal phase:
 * ovulation is estimated at `length − lutealLength`, not at day 14.
 *
 * Phases never overlap. Physiologically the follicular phase starts on day 1
 * alongside menstruation; here it starts after the period for readability.
 */
export function phaseBoundaries(
  length: number,
  periodLength: number,
  lutealLength: number,
): { phases: PhaseDays[]; warning?: string } {
  const ovulationDay = length - lutealLength;
  const menstrual: PhaseDays = { phase: 'menstrual', startDay: 1, endDay: periodLength };

  // Short cycles or long periods can squeeze out follicular, then ovulatory.
  const ovulatoryStart = Math.max(ovulationDay - 1, periodLength + 1);
  const ovulatoryEnd = ovulationDay + 1;
  if (ovulatoryEnd < ovulatoryStart) {
    return {
      phases: [menstrual, { phase: 'luteal', startDay: periodLength + 1, endDay: length }],
      warning:
        `A ${length}-day cycle with a ${periodLength}-day period length and ${lutealLength}-day ` +
        'luteal length leaves no room for the follicular and ovulatory phases, so only menstrual ' +
        'and luteal are shown. Check the period length and luteal length settings.',
    };
  }

  const phases: PhaseDays[] = [menstrual];
  if (ovulatoryStart > periodLength + 1) {
    phases.push({ phase: 'follicular', startDay: periodLength + 1, endDay: ovulatoryStart - 1 });
  }
  phases.push({ phase: 'ovulatory', startDay: ovulatoryStart, endDay: ovulatoryEnd });
  phases.push({ phase: 'luteal', startDay: ovulatoryEnd + 1, endDay: length });
  return { phases };
}

export interface Schedule {
  stats: CycleStats;
  /** All phase spans to put on the calendar, in date order. */
  spans: PhaseSpan[];
  today: { phase: PhaseName; cycleDay: number; cycleLength: number } | null;
  nextPredictedStart: ISODate | null;
  /** Days since the predicted next period start, when no newer start has been logged. */
  lateByDays: number;
  warnings: string[];
}

/**
 * The anchored cycle (from the most recent logged start) plus predicted cycles
 * until `today + monthsAhead`. Predicted cycles that ended before today are
 * skipped, so a long gap since the last log doesn't fill the calendar with the past.
 */
export function buildSchedule(starts: ISODate[], settings: Settings, today: ISODate): Schedule {
  const warnings: string[] = [];

  const future = [...new Set(starts.filter((s) => s > today))].sort(compareDates);
  for (const date of future) {
    warnings.push(`Ignored ${date}: it is in the future. Log a period start once it has happened.`);
  }

  const stats = computeStats(
    starts.filter((s) => s <= today),
    settings,
  );
  const anchor = stats.starts[stats.starts.length - 1];
  if (!anchor) {
    warnings.push('No period start dates logged yet. Add one to the Log tab to see predictions.');
    return { stats, spans: [], today: null, nextPredictedStart: null, lateByDays: 0, warnings };
  }

  const length = stats.averageLength;
  const { phases, warning } = phaseBoundaries(length, settings.periodLength, settings.lutealLength);
  if (warning) warnings.push(warning);

  const expectedNext = addDays(anchor, length);
  const lateByDays = Math.max(0, diffDays(expectedNext, today));
  if (lateByDays > 0) {
    warnings.push(
      `Your period may be late: it was predicted to start ${expectedNext} (${lateByDays} ` +
        `day${lateByDays === 1 ? '' : 's'} ago). Log your start date when it arrives.`,
    );
  }

  const windowEnd = addMonths(today, settings.monthsAhead);
  const spans: PhaseSpan[] = [];
  for (
    let cycleIndex = 0, cycleStart = anchor;
    compareDates(cycleStart, windowEnd) <= 0;
    cycleIndex++, cycleStart = addDays(cycleStart, length)
  ) {
    const cycleEnd = addDays(cycleStart, length - 1);
    if (cycleIndex > 0 && cycleEnd < today) continue;
    for (const p of phases) {
      spans.push({
        ...p,
        start: addDays(cycleStart, p.startDay - 1),
        end: addDays(cycleStart, p.endDay - 1),
        cycleStart,
        cycleLength: length,
        cycleIndex,
        predicted: cycleIndex > 0,
      });
    }
  }

  const current = spans.find((s) => s.start <= today && today <= s.end);
  const nextStart = spans.find((s) => s.startDay === 1 && s.start > today);

  return {
    stats,
    spans,
    today: current
      ? {
          phase: current.phase,
          cycleDay: diffDays(current.cycleStart, today) + 1,
          cycleLength: length,
        }
      : null,
    nextPredictedStart: nextStart?.start ?? null,
    lateByDays,
    warnings,
  };
}
