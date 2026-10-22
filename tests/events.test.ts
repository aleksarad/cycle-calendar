import { describe, expect, it } from 'vitest';
import { EVENT_COLOR_IDS, colorId, parseEventColor } from '../src/core/colors';
import { buildSchedule } from '../src/core/cycle';
import { TAG_FILTER, buildEvents } from '../src/core/events';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import type { ISODate, Settings } from '../src/core/types';

const today = '2026-10-18' as ISODate;
const eventsFor = (starts: string[], settings: Settings = DEFAULT_SETTINGS) =>
  buildEvents(buildSchedule(starts as ISODate[], settings, today), settings);

describe('colors', () => {
  it('maps all 11 preset colors to Calendar API color IDs', () => {
    expect(Object.keys(EVENT_COLOR_IDS)).toHaveLength(11);
    expect(colorId('PALE_BLUE')).toBe('1');
    expect(colorId('MAUVE')).toBe('3');
    expect(colorId('YELLOW')).toBe('5');
    expect(colorId('GREEN')).toBe('10');
    expect(colorId('RED')).toBe('11');
  });

  it('only accepts real preset names', () => {
    expect(parseEventColor('pale-green')).toBe('PALE_GREEN');
    expect(parseEventColor('constructor')).toBeNull();
    expect(parseEventColor('__proto__')).toBeNull();
  });
});

describe('buildEvents', () => {
  const events = eventsFor(['2026-09-01', '2026-09-29']);

  it('creates one all-day event per phase per cycle', () => {
    const schedule = buildSchedule(
      ['2026-09-01', '2026-09-29'] as ISODate[],
      DEFAULT_SETTINGS,
      today,
    );
    expect(events).toHaveLength(schedule.spans.length);
    expect(events.length % 4).toBe(0);
  });

  it('uses an exclusive end date: the day after the last phase day', () => {
    expect(events[0]).toMatchObject({
      summary: '🌑 Menstrual',
      start: { date: '2026-09-29' },
      end: { date: '2026-10-04' }, // menstrual is Sep 29 – Oct 3
    });
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.start.date).toBe(events[i - 1]!.end.date);
    }
  });

  it('crosses a year boundary with the exclusive end', () => {
    // Predicted cycle starting 2026-12-22: follicular runs Dec 27 – Jan 2.
    expect(events.find((e) => e.start.date === '2026-12-27')).toMatchObject({
      summary: '🌒 Follicular (predicted)',
      end: { date: '2027-01-03' },
    });
  });

  it('titles phases from Settings and marks predicted cycles', () => {
    expect(events.slice(0, 4).map((e) => e.summary)).toEqual([
      '🌑 Menstrual',
      '🌒 Follicular',
      '🌕 Ovulatory',
      '🌘 Luteal',
    ]);
    expect(events[4]!.summary).toBe('🌑 Menstrual (predicted)');
    expect(events.slice(4).every((e) => e.summary.endsWith(' (predicted)'))).toBe(true);
  });

  it('colors phases from Settings', () => {
    expect(events.slice(0, 4).map((e) => e.colorId)).toEqual(['11', '10', '5', '3']);
    const custom = eventsFor(['2026-09-29'], {
      ...DEFAULT_SETTINGS,
      colors: { ...DEFAULT_SETTINGS.colors, luteal: 'PALE_BLUE' },
    });
    expect(custom.find((e) => e.summary.startsWith('🌘'))!.colorId).toBe('1');
  });

  it('shows every event as free and private, with no reminders, tagged for sync', () => {
    for (const event of events) {
      expect(event).toMatchObject({
        transparency: 'transparent',
        visibility: 'private',
        reminders: { useDefault: false, overrides: [] },
        extendedProperties: { private: { cyclePhaseCalendar: 'v1' } },
      });
    }
    expect(TAG_FILTER).toBe('cyclePhaseCalendar=v1');
  });

  it('includes the phase description with the disclaimer', () => {
    expect(events[1]!.description).toMatch(/^Days 6–12 of an estimated 28-day cycle\./);
    expect(events.every((e) => e.description.endsWith('Not for contraception.'))).toBe(true);
  });

  it('adds the irregular note to predicted cycles only', () => {
    // Gaps of 24, 38, 26, 36 days, last start recent enough not to be late.
    const irregular = eventsFor([
      '2026-05-14',
      '2026-06-07',
      '2026-07-15',
      '2026-08-10',
      '2026-09-15',
    ]);
    const note = /could shift/;
    expect(
      irregular
        .filter((e) => !e.summary.includes('predicted'))
        .some((e) => note.test(e.description)),
    ).toBe(false);
    expect(
      irregular
        .filter((e) => e.summary.includes('predicted'))
        .every((e) => note.test(e.description)),
    ).toBe(true);
  });

  it('creates nothing when nothing is logged', () => {
    expect(eventsFor([])).toEqual([]);
  });

  it('never produces empty events', () => {
    for (const event of events) expect(event.end.date > event.start.date).toBe(true);
  });
});
