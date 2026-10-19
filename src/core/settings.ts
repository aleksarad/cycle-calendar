// The Settings tab: its rows, defaults, and validation.
//
// The sheet adapter reads the tab into a label → value map and passes it here.
// Every field is validated on its own: a bad value falls back to its default and
// produces a warning for the Status tab. Nothing here throws.

import { parseEventColor, type EventColorName } from './colors';
import { PHASES, type PhaseName, type Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  defaultCycleLength: 28,
  periodLength: 5,
  lutealLength: 14,
  cyclesToAverage: 6,
  monthsAhead: 6,
  calendarName: 'Cycle Phases',
  titles: {
    menstrual: '🌑 Menstrual',
    follicular: '🌒 Follicular',
    ovulatory: '🌕 Ovulatory',
    luteal: '🌘 Luteal',
  },
  colors: { menstrual: 'RED', follicular: 'GREEN', ovulatory: 'YELLOW', luteal: 'MAUVE' },
};

type NumberKey =
  'defaultCycleLength' | 'periodLength' | 'lutealLength' | 'cyclesToAverage' | 'monthsAhead';

const NUMBER_FIELDS: { key: NumberKey; label: string; min: number; max: number; note: string }[] = [
  {
    key: 'defaultCycleLength',
    label: 'Default cycle length (days)',
    min: 21,
    max: 45,
    note: 'Used until you have logged at least 2 period start dates.',
  },
  {
    key: 'periodLength',
    label: 'Period length (days)',
    min: 1,
    max: 10,
    note: 'Length of the menstrual phase.',
  },
  {
    key: 'lutealLength',
    label: 'Luteal length (days)',
    min: 10,
    max: 16,
    note: 'Days from ovulation to the next period. Used to estimate ovulation.',
  },
  {
    key: 'cyclesToAverage',
    label: 'Cycles to average',
    min: 1,
    max: 24,
    note: 'How many of your most recent cycles the average uses.',
  },
  {
    key: 'monthsAhead',
    label: 'Months ahead',
    min: 1,
    max: 12,
    note: 'How far ahead to show predictions.',
  },
];

const CALENDAR_NAME_LABEL = 'Calendar name';
const MAX_TEXT_LENGTH = 100;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const titleLabel = (phase: PhaseName) => `${capitalize(phase)} title`;
const colorLabel = (phase: PhaseName) => `${capitalize(phase)} color`;

export interface SettingRow {
  label: string;
  defaultValue: string | number;
  note: string;
  /** Color rows get a dropdown of Google's preset event colors. */
  isColor?: boolean;
}

/** Rows of the Settings tab, in display order, for the sheet adapter to create. */
export const SETTING_ROWS: SettingRow[] = [
  ...NUMBER_FIELDS.map((f) => ({
    label: f.label,
    defaultValue: DEFAULT_SETTINGS[f.key],
    note: `${f.note} Whole number, ${f.min}–${f.max}.`,
  })),
  {
    label: CALENDAR_NAME_LABEL,
    defaultValue: DEFAULT_SETTINGS.calendarName,
    note: 'Name of the dedicated calendar the script creates. Never your main calendar.',
  },
  ...PHASES.map((p) => ({
    label: titleLabel(p),
    defaultValue: DEFAULT_SETTINGS.titles[p],
    note: 'Event title. Predicted cycles get " (predicted)" added.',
  })),
  ...PHASES.map((p) => ({
    label: colorLabel(p),
    defaultValue: DEFAULT_SETTINGS.colors[p],
    note: 'One of Google Calendar’s preset event colors.',
    isColor: true,
  })),
];

function parseInteger(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(n) && !(typeof value === 'string' && value.trim() === '') ? n : null;
}

function parseText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= MAX_TEXT_LENGTH ? text : null;
}

function describe(value: unknown): string {
  if (value === undefined) return 'missing';
  if (typeof value === 'string' && value.trim() === '') return 'blank';
  return `"${String(value)}"`;
}

export function parseSettings(raw: Record<string, unknown>): {
  settings: Settings;
  warnings: string[];
} {
  const warnings: string[] = [];
  const fallback = (label: string, value: unknown, defaultValue: unknown, rule: string) => {
    warnings.push(
      `Setting "${label}" is ${describe(value)}; ${rule}. Using the default (${String(defaultValue)}).`,
    );
  };

  const numbers = {} as Record<NumberKey, number>;
  for (const { key, label, min, max } of NUMBER_FIELDS) {
    const n = parseInteger(raw[label]);
    if (n !== null && n >= min && n <= max) {
      numbers[key] = n;
    } else {
      numbers[key] = DEFAULT_SETTINGS[key];
      fallback(
        label,
        raw[label],
        DEFAULT_SETTINGS[key],
        `expected a whole number from ${min} to ${max}`,
      );
    }
  }

  const text = (label: string, defaultValue: string): string => {
    const t = parseText(raw[label]);
    if (t !== null) return t;
    fallback(label, raw[label], defaultValue, `expected text up to ${MAX_TEXT_LENGTH} characters`);
    return defaultValue;
  };

  const color = (label: string, defaultValue: EventColorName): EventColorName => {
    const value = raw[label];
    const c = typeof value === 'string' ? parseEventColor(value) : null;
    if (c !== null) return c;
    fallback(
      label,
      value,
      defaultValue,
      'expected a Google Calendar color name like RED or PALE_BLUE',
    );
    return defaultValue;
  };

  const settings: Settings = {
    ...numbers,
    calendarName: text(CALENDAR_NAME_LABEL, DEFAULT_SETTINGS.calendarName),
    titles: Object.fromEntries(
      PHASES.map((p) => [p, text(titleLabel(p), DEFAULT_SETTINGS.titles[p])]),
    ) as Record<PhaseName, string>,
    colors: Object.fromEntries(
      PHASES.map((p) => [p, color(colorLabel(p), DEFAULT_SETTINGS.colors[p])]),
    ) as Record<PhaseName, EventColorName>,
  };

  return { settings, warnings };
}
