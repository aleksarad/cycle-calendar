import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTING_ROWS, parseSettings } from '../src/core/settings';

/** Raw sheet values keyed by label, as the Settings tab would provide them. */
function rawWith(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const row of SETTING_ROWS) raw[row.label] = row.defaultValue;
  return { ...raw, ...overrides };
}

describe('parseSettings', () => {
  it('reads every default without warnings', () => {
    const { settings, warnings } = parseSettings(rawWith());
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(warnings).toEqual([]);
  });

  it('matches the defaults in the spec', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
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
    });
  });

  it('accepts valid custom values, including numeric strings and loose color names', () => {
    const { settings, warnings } = parseSettings(
      rawWith({
        'Default cycle length (days)': '30',
        'Period length (days)': 7,
        'Calendar name': '  My cycle  ',
        'Luteal title': 'PMS week',
        'Luteal color': ' pale blue ',
      }),
    );
    expect(warnings).toEqual([]);
    expect(settings.defaultCycleLength).toBe(30);
    expect(settings.periodLength).toBe(7);
    expect(settings.calendarName).toBe('My cycle');
    expect(settings.titles.luteal).toBe('PMS week');
    expect(settings.colors.luteal).toBe('PALE_BLUE');
  });

  it.each([
    ['Default cycle length (days)', 'defaultCycleLength', 60],
    ['Default cycle length (days)', 'defaultCycleLength', 'abc'],
    ['Period length (days)', 'periodLength', 0],
    ['Period length (days)', 'periodLength', 5.5],
    ['Luteal length (days)', 'lutealLength', 30],
    ['Cycles to average', 'cyclesToAverage', -1],
    ['Months ahead', 'monthsAhead', 24],
  ] as const)('falls back when %s is %j', (label, key, value) => {
    const { settings, warnings } = parseSettings(rawWith({ [label]: value }));
    expect(settings[key]).toBe(DEFAULT_SETTINGS[key]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(label);
  });

  it('falls back on an unknown color name', () => {
    const { settings, warnings } = parseSettings(rawWith({ 'Ovulatory color': 'turquoise' }));
    expect(settings.colors.ovulatory).toBe('YELLOW');
    expect(warnings[0]).toContain('Ovulatory color');
  });

  it('falls back on blank text and missing rows', () => {
    const raw = rawWith({ 'Calendar name': '   ' });
    delete raw['Menstrual title'];
    const { settings, warnings } = parseSettings(raw);
    expect(settings.calendarName).toBe('Cycle Phases');
    expect(settings.titles.menstrual).toBe('🌑 Menstrual');
    expect(warnings).toHaveLength(2);
  });

  it('never throws, whatever it is given', () => {
    const junk = [null, undefined, {}, [], new Date(), NaN, Infinity, true];
    for (const value of junk) {
      const raw: Record<string, unknown> = {};
      for (const row of SETTING_ROWS) raw[row.label] = value;
      expect(() => parseSettings(raw)).not.toThrow();
      expect(parseSettings(raw).settings).toEqual(DEFAULT_SETTINGS);
    }
  });
});
