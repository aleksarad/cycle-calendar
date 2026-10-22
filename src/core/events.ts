// Turns a schedule into Calendar API event resources (spec §5). Pure: the
// calendar adapter sends these as-is with Calendar.Events.insert.

import { describePhase } from '../content/phases';
import { colorId } from './colors';
import type { Schedule } from './cycle';
import { exclusiveEnd } from './dates';
import type { ISODate, PhaseSpan, Settings } from './types';

/** Every event the script creates carries this private property; sync only ever deletes tagged events. */
export const TAG_KEY = 'cyclePhaseCalendar';
export const TAG_VALUE = 'v1';
/** The `privateExtendedProperty` filter for Calendar.Events.list. */
export const TAG_FILTER = `${TAG_KEY}=${TAG_VALUE}`;

export const PREDICTED_SUFFIX = ' (predicted)';

/** The subset of the Calendar API's Event resource the script sets. */
export interface EventResource {
  summary: string;
  description: string;
  start: { date: ISODate };
  /** Exclusive: the day after the phase's last day. */
  end: { date: ISODate };
  colorId: string;
  /** Show as free, so phases never block availability. */
  transparency: 'transparent';
  visibility: 'private';
  /** No notifications for phase events. */
  reminders: { useDefault: false; overrides: [] };
  extendedProperties: { private: Record<string, string> };
}

export function eventTitle(span: PhaseSpan, settings: Settings): string {
  return settings.titles[span.phase] + (span.predicted ? PREDICTED_SUFFIX : '');
}

export function buildEvents(schedule: Schedule, settings: Settings): EventResource[] {
  return schedule.spans.map((span) => ({
    summary: eventTitle(span, settings),
    description: describePhase(span, schedule.stats),
    start: { date: span.start },
    end: { date: exclusiveEnd(span.end) },
    colorId: colorId(settings.colors[span.phase]),
    transparency: 'transparent',
    visibility: 'private',
    reminders: { useDefault: false, overrides: [] },
    extendedProperties: { private: { [TAG_KEY]: TAG_VALUE } },
  }));
}
