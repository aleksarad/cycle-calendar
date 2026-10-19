import { describe, expect, it } from 'vitest';
import { DISCLAIMER, PHASE_CONTENT, describePhase } from '../src/content/phases';
import { buildSchedule } from '../src/core/cycle';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import {
  PHASES,
  type CycleStats,
  type ISODate,
  type PhaseName,
  type PhaseSpan,
} from '../src/core/types';

/** The four spans of a regular 28-day cycle with default settings. */
const spans = buildSchedule(
  ['2026-09-01', '2026-09-29'] as ISODate[],
  DEFAULT_SETTINGS,
  '2026-10-18' as ISODate,
).spans.slice(0, 4);
const spanFor = (phase: PhaseName) => spans.find((s) => s.phase === phase)!;

const statsWith = (overrides: Partial<CycleStats> = {}): CycleStats => ({
  starts: [],
  intervals: [],
  typicalLength: 28,
  basedOn: 6,
  irregular: false,
  ...overrides,
});
const irregular = statsWith({ shortest: 24, longest: 38, irregular: true });
const IRREGULAR_NOTE = 'Your recent cycles ranged from 24 to 38 days, so these dates could shift.';

describe('describePhase', () => {
  it.each(PHASES)('renders the %s description', (phase) => {
    expect(describePhase(spanFor(phase), statsWith())).toMatchSnapshot();
  });

  it('describes the cycle days covered', () => {
    expect(describePhase(spanFor('follicular'), statsWith())).toMatch(
      /^Days 6–12 of an estimated 28-day cycle\./,
    );
  });

  it('uses "Day" for a single-day phase', () => {
    const oneDay: PhaseSpan = { ...spanFor('ovulatory'), startDay: 8, endDay: 8 };
    expect(describePhase(oneDay, statsWith())).toMatch(/^Day 8 of/);
  });

  it('says how many cycles the estimate is based on', () => {
    expect(describePhase(spanFor('luteal'), statsWith())).toContain(
      'Estimated from your last 6 cycles.',
    );
    expect(describePhase(spanFor('luteal'), statsWith({ basedOn: 1 }))).toContain(
      'Estimated from your last 1 cycle.',
    );
    expect(describePhase(spanFor('luteal'), statsWith({ basedOn: 0 }))).toContain(
      'default 28-day cycle length',
    );
  });

  it('ends every description with the disclaimer', () => {
    for (const phase of PHASES) {
      expect(describePhase(spanFor(phase), statsWith()).endsWith(DISCLAIMER)).toBe(true);
    }
    expect(DISCLAIMER).toBe('General information, not medical advice. Not for contraception.');
  });

  it('notes irregular cycles on predicted cycles, before the disclaimer', () => {
    const predicted: PhaseSpan = { ...spanFor('menstrual'), cycleIndex: 1, predicted: true };
    const text = describePhase(predicted, irregular);
    expect(text).toContain(`${IRREGULAR_NOTE}\n\n${DISCLAIMER}`);
  });

  it('leaves the irregular note off the current cycle and off regular cycles', () => {
    const predicted: PhaseSpan = { ...spanFor('menstrual'), cycleIndex: 1, predicted: true };
    expect(describePhase(spanFor('menstrual'), irregular)).not.toContain('could shift');
    expect(describePhase(predicted, statsWith({ shortest: 27, longest: 30 }))).not.toContain(
      'could shift',
    );
  });

  it('says the ovulatory timing is an estimate', () => {
    expect(PHASE_CONTENT.ovulatory.hormones).toMatch(/estimate/i);
  });
});

describe('phase copy', () => {
  // Wording that would imply fertility tracking, diagnosis or certainty (spec §1.4).
  const FORBIDDEN = [
    /fertil/i,
    /safe days?/i,
    /diagnos/i,
    /guarantee/i,
    /\bwill\b/i,
    /\balways\b/i,
  ];

  it.each(PHASES)('%s avoids implying certainty or fertility guidance', (phase) => {
    const { hormones, experiences } = PHASE_CONTENT[phase];
    for (const text of [hormones, ...experiences]) {
      for (const pattern of FORBIDDEN) expect(text).not.toMatch(pattern);
    }
  });

  it.each(PHASES)('%s has a short list of experiences', (phase) => {
    const { experiences } = PHASE_CONTENT[phase];
    expect(experiences.length).toBeGreaterThanOrEqual(3);
    expect(experiences.length).toBeLessThanOrEqual(5);
  });
});
