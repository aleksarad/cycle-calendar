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

// Cycle length rules (spec §4.1). Outliers are judged against the user's own
// recent history, so a consistently long cycle is predicted, not discarded.

/** No single cycle is shorter or longer than this; such intervals are always excluded. */
export const PLAUSIBLE_MIN = 15;
export const PLAUSIBLE_MAX = 90;
/** With 3+ recent intervals, keep those within these multiples of their median. */
export const PERSONAL_LOW = 0.75;
export const PERSONAL_HIGH = 1.6;
export const MIN_FOR_PERSONAL = 3;
/** With fewer, there's too little history to judge, so fixed bounds apply. */
export const FALLBACK_MIN = 21;
export const FALLBACK_MAX = 45;
/** A spread between shortest and longest above this many days counts as irregular. */
export const IRREGULAR_RANGE = 7;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const LEFT_OUT = "so it's left out of the estimate";

function plausibilityReason(days: number): string | undefined {
  if (days < PLAUSIBLE_MIN) {
    return `${days} days is too short to be a full cycle, possibly an extra or mistyped date`;
  }
  if (days > PLAUSIBLE_MAX) {
    return `${days} days is too long to be a single cycle, possibly missed logs`;
  }
  return undefined;
}

/** Returns a reason to exclude `days` given the recent window, or undefined to keep it. */
function outlierRule(window: number[]): (days: number) => string | undefined {
  if (window.length >= MIN_FOR_PERSONAL) {
    const m = median(window);
    const low = Math.round(PERSONAL_LOW * m);
    const high = Math.round(PERSONAL_HIGH * m);
    const usual = `usual for you (typically ${Math.round(m)})`;
    return (days) =>
      days > high
        ? `${days} days is longer than ${usual}, possibly a missed log, ${LEFT_OUT}`
        : days < low
          ? `${days} days is shorter than ${usual}, possibly an extra or mistyped date, ${LEFT_OUT}`
          : undefined;
  }
  return (days) =>
    days > FALLBACK_MAX
      ? `${days} days is longer than ${FALLBACK_MAX}, possibly a missed log, ${LEFT_OUT}`
      : days < FALLBACK_MIN
        ? `${days} days is shorter than ${FALLBACK_MIN}, possibly an extra or mistyped date, ${LEFT_OUT}`
        : undefined;
}

export function computeStats(starts: ISODate[], settings: Settings): CycleStats {
  const unique = [...new Set(starts)].sort(compareDates);

  const intervals: Interval[] = [];
  for (let i = 1; i < unique.length; i++) {
    const from = unique[i - 1]!;
    const to = unique[i]!;
    const days = diffDays(from, to);
    const excludedReason = plausibilityReason(days);
    intervals.push(excludedReason ? { from, to, days, excludedReason } : { from, to, days });
  }

  // Judge the most recent plausible intervals, at least 3 so a low "Cycles to
  // average" still has enough history. Older intervals are neither judged nor used.
  const window = intervals
    .filter((i) => !i.excludedReason)
    .slice(-Math.max(settings.cyclesToAverage, MIN_FOR_PERSONAL));
  const exclude = outlierRule(window.map((i) => i.days));
  for (const interval of window) {
    const reason = exclude(interval.days);
    if (reason) interval.excludedReason = reason;
  }

  const used = window
    .filter((i) => !i.excludedReason)
    .slice(-settings.cyclesToAverage)
    .map((i) => i.days);

  const stats: CycleStats = {
    starts: unique,
    intervals,
    typicalLength: used.length ? Math.round(median(used)) : settings.defaultCycleLength,
    basedOn: used.length,
    irregular: false,
  };
  if (used.length >= 2) {
    stats.shortest = Math.min(...used);
    stats.longest = Math.max(...used);
    stats.irregular = stats.longest - stats.shortest > IRREGULAR_RANGE;
  }
  return stats;
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

  const length = stats.typicalLength;
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
