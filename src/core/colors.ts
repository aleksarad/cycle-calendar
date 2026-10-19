/**
 * Google Calendar's 11 preset event colors, keyed by their `CalendarApp.EventColor` name.
 * The Calendar advanced service takes the numeric `colorId`; per-event hex colors aren't supported.
 */
export const EVENT_COLOR_IDS = {
  PALE_BLUE: '1',
  PALE_GREEN: '2',
  MAUVE: '3',
  PALE_RED: '4',
  YELLOW: '5',
  ORANGE: '6',
  CYAN: '7',
  GRAY: '8',
  BLUE: '9',
  GREEN: '10',
  RED: '11',
} as const;

export type EventColorName = keyof typeof EVENT_COLOR_IDS;

/** Normalizes user input like " pale blue " to `PALE_BLUE`; returns null if it isn't a preset color. */
export function parseEventColor(value: string): EventColorName | null {
  const name = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return Object.prototype.hasOwnProperty.call(EVENT_COLOR_IDS, name)
    ? (name as EventColorName)
    : null;
}

export function colorId(name: EventColorName): string {
  return EVENT_COLOR_IDS[name];
}
