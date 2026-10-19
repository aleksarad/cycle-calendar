// Date-only arithmetic on `YYYY-MM-DD` strings.
//
// Internally a date is converted to a whole-day count via Date.UTC. UTC has no
// DST, so every day is exactly 24 hours and results never depend on the
// timezone the code runs in. No Date object escapes this module.

import type { ISODate } from './types';

const MS_PER_DAY = 86_400_000;
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function toDayNumber(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function fromDayNumber(day: number): ISODate {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10) as ISODate;
}

/** Returns the date if `value` is a real calendar date in `YYYY-MM-DD` form, otherwise null. */
export function parseISODate(value: string): ISODate | null {
  const match = ISO_PATTERN.exec(value);
  if (!match) return null;
  const candidate = value as ISODate;
  // Round-tripping rejects dates like 2026-02-30, which Date.UTC would roll over.
  return fromDayNumber(toDayNumber(candidate)) === value ? candidate : null;
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return toDayNumber(b) - toDayNumber(a);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Adds calendar months, clamping to the last day of the target month (Aug 31 + 6 → Feb 28). */
export function addMonths(date: ISODate, months: number): ISODate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10) as ISODate;
}

/** The Calendar API's all-day `end.date` is exclusive: the day after the last day. */
export function exclusiveEnd(lastDay: ISODate): ISODate {
  return addDays(lastDay, 1);
}
