import { describe, expect, it } from 'vitest';
import { parseLogValues } from '../src/core/log';

describe('parseLogValues', () => {
  it('keeps dates and skips blank rows', () => {
    const { dates, warnings } = parseLogValues(['2026-09-01', '', null, '  ', '2026-09-29']);
    expect(dates).toEqual(['2026-09-01', '2026-09-29']);
    expect(warnings).toEqual([]);
  });

  it('accepts date-like text with surrounding spaces', () => {
    expect(parseLogValues([' 2026-10-01 ']).dates).toEqual(['2026-10-01']);
  });

  it('reports non-dates with their sheet row number', () => {
    const { dates, warnings } = parseLogValues(['2026-09-01', 'last tuesday', 45200, '2026-02-30']);
    expect(dates).toEqual(['2026-09-01']);
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toMatch(/^Log row 3: "last tuesday"/);
    expect(warnings[1]).toMatch(/^Log row 4: "45200"/);
    expect(warnings[2]).toMatch(/^Log row 5: "2026-02-30"/);
  });

  it('passes duplicates through for computeStats to dedupe', () => {
    expect(parseLogValues(['2026-09-01', '2026-09-01']).dates).toHaveLength(2);
  });

  it('never throws on unexpected cell types', () => {
    expect(() => parseLogValues([true, {}, [], NaN, undefined])).not.toThrow();
  });
});
