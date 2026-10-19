// Calendar event descriptions. Edit the copy in PHASE_CONTENT freely; the
// functions below only assemble it. Keep the framing general ("commonly
// reported", "estimated"): this is information, not medical advice.

import type { CycleStats, PhaseName, PhaseSpan } from '../core/types';

interface PhaseContent {
  /** What's generally happening hormonally, in one or two sentences. */
  hormones: string;
  /** Short, commonly reported experiences: energy, mood, physical. */
  experiences: string[];
}

export const PHASE_CONTENT: Record<PhaseName, PhaseContent> = {
  menstrual: {
    hormones:
      'Estrogen and progesterone are at their lowest, and the uterine lining is shed as a period.',
    experiences: [
      'Lower energy, especially in the first few days',
      'Cramps or lower back ache',
      'Wanting more rest and quieter time',
      'Mood often lifting as the period eases',
    ],
  },
  follicular: {
    hormones:
      'Estrogen rises as follicles in the ovaries develop, and the uterine lining begins to rebuild.',
    experiences: [
      'Energy and motivation building',
      'A brighter, more social mood',
      'Feeling focused and open to new things',
    ],
  },
  ovulatory: {
    hormones:
      'Estrogen peaks and a surge of luteinizing hormone (LH) triggers the release of an egg. ' +
      'These dates are an estimate: actual ovulation can shift by several days from cycle to ' +
      'cycle, and this calendar cannot detect it.',
    experiences: ['Peak energy for many people', 'Feeling confident and sociable', 'Higher libido'],
  },
  luteal: {
    hormones:
      'Progesterone rises after ovulation. If pregnancy does not occur, progesterone and ' +
      'estrogen fall toward the end of this phase, leading into the next period.',
    experiences: [
      'Steady energy early on, tapering later',
      'In the final days, PMS for some: bloating, irritability or low mood',
      'Food cravings',
      'Lighter or more restless sleep',
    ],
  },
};

export const DISCLAIMER = 'General information, not medical advice. Not for contraception.';

function dayRange(span: PhaseSpan): string {
  return span.startDay === span.endDay
    ? `Day ${span.startDay}`
    : `Days ${span.startDay}–${span.endDay}`;
}

function basis(basedOn: number, cycleLength: number): string {
  if (basedOn === 0) {
    return `Estimated from the default ${cycleLength}-day cycle length. Log more period start dates to personalize it.`;
  }
  return `Estimated from your last ${basedOn} cycle${basedOn === 1 ? '' : 's'}.`;
}

/** Only on predicted cycles: the current one is anchored on a real logged date. */
function irregularNote(span: PhaseSpan, stats: CycleStats): string | null {
  if (!span.predicted || !stats.irregular) return null;
  return `Your recent cycles ranged from ${stats.shortest} to ${stats.longest} days, so these dates could shift.`;
}

/** The full event description for one phase span. */
export function describePhase(span: PhaseSpan, stats: CycleStats): string {
  const content = PHASE_CONTENT[span.phase];
  return [
    `${dayRange(span)} of an estimated ${span.cycleLength}-day cycle.`,
    content.hormones,
    [
      'Commonly reported (everyone is different):',
      ...content.experiences.map((e) => `• ${e}`),
    ].join('\n'),
    basis(stats.basedOn, span.cycleLength),
    irregularNote(span, stats),
    DISCLAIMER,
  ]
    .filter((part) => part !== null)
    .join('\n\n');
}
