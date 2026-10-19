import { describe, expect, it } from 'vitest';
import { DISCLAIMER, PHASE_CONTENT, describePhase } from '../src/content/phases';
import { buildSchedule } from '../src/core/cycle';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { PHASES, type ISODate, type PhaseName, type PhaseSpan } from '../src/core/types';

/** The four spans of a regular 28-day cycle with default settings. */
const spans = buildSchedule(
  ['2026-09-01', '2026-09-29'] as ISODate[],
  DEFAULT_SETTINGS,
  '2026-10-18' as ISODate,
).spans.slice(0, 4);
const spanFor = (phase: PhaseName) => spans.find((s) => s.phase === phase)!;

describe('describePhase', () => {
  it.each(PHASES)('renders the %s description', (phase) => {
    expect(describePhase(spanFor(phase), 6)).toMatchSnapshot();
  });

  it('describes the cycle days covered', () => {
    expect(describePhase(spanFor('follicular'), 6)).toMatch(
      /^Days 6–12 of an estimated 28-day cycle\./,
    );
  });

  it('uses "Day" for a single-day phase', () => {
    const oneDay: PhaseSpan = { ...spanFor('ovulatory'), startDay: 8, endDay: 8 };
    expect(describePhase(oneDay, 6)).toMatch(/^Day 8 of/);
  });

  it('says how many cycles the estimate is based on', () => {
    expect(describePhase(spanFor('luteal'), 6)).toContain('Estimated from your last 6 cycles.');
    expect(describePhase(spanFor('luteal'), 1)).toContain('Estimated from your last 1 cycle.');
    expect(describePhase(spanFor('luteal'), 0)).toContain('default 28-day cycle length');
  });

  it('ends every description with the disclaimer', () => {
    for (const phase of PHASES) {
      expect(describePhase(spanFor(phase), 6).endsWith(DISCLAIMER)).toBe(true);
    }
    expect(DISCLAIMER).toBe('General information, not medical advice. Not for contraception.');
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
