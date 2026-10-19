import type { EventColorName } from './colors';

/** A calendar day with no time or timezone, formatted `YYYY-MM-DD`. Create via `parseISODate`. */
export type ISODate = string & { readonly __brand: 'ISODate' };

export type PhaseName = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export const PHASES: readonly PhaseName[] = ['menstrual', 'follicular', 'ovulatory', 'luteal'];

export interface Settings {
  defaultCycleLength: number;
  periodLength: number;
  lutealLength: number;
  cyclesToAverage: number;
  monthsAhead: number;
  calendarName: string;
  titles: Record<PhaseName, string>;
  colors: Record<PhaseName, EventColorName>;
}

/** One phase within a cycle, in 1-based cycle days. `endDay` is inclusive. */
export interface PhaseDays {
  phase: PhaseName;
  startDay: number;
  endDay: number;
}

/** One phase placed on the calendar. `end` is the last day of the phase (inclusive). */
export interface PhaseSpan extends PhaseDays {
  start: ISODate;
  end: ISODate;
  cycleStart: ISODate;
  cycleLength: number;
  /** 0 for the cycle anchored on the most recent logged start; predicted cycles are > 0. */
  cycleIndex: number;
  predicted: boolean;
}

export interface Interval {
  from: ISODate;
  to: ISODate;
  days: number;
  /** Present when the interval was left out of the average. */
  excludedReason?: string;
}

export interface CycleStats {
  /** Unique logged starts, ascending. */
  starts: ISODate[];
  intervals: Interval[];
  /** Cycle length used for predictions: the median of recent intervals, in days. */
  typicalLength: number;
  /** How many intervals the typical length is based on; 0 means the default was used. */
  basedOn: number;
  /** Shortest and longest interval used; present when 2 or more were used. */
  shortest?: number;
  longest?: number;
  /** True when `longest − shortest` exceeds IRREGULAR_RANGE days. */
  irregular: boolean;
}
