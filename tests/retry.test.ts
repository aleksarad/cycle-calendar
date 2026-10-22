import { describe, expect, it } from 'vitest';
import { isRetryable, withRetry } from '../src/core/retry';

/** A function that throws the given errors in order, then returns 'ok'. */
function failing(...errors: Error[]) {
  let calls = 0;
  const fn = () => {
    const error = errors[calls++];
    if (error) throw error;
    return 'ok';
  };
  return { fn, calls: () => calls };
}

describe('withRetry', () => {
  it('returns immediately on success', () => {
    const sleeps: number[] = [];
    expect(
      withRetry(
        () => 42,
        (ms) => sleeps.push(ms),
      ),
    ).toBe(42);
    expect(sleeps).toEqual([]);
  });

  it('retries rate-limit errors with exponential backoff', () => {
    const sleeps: number[] = [];
    const { fn, calls } = failing(
      new Error('Rate Limit Exceeded'),
      new Error('Calendar usage limits exceeded.'),
    );
    expect(withRetry(fn, (ms) => sleeps.push(ms))).toBe('ok');
    expect(calls()).toBe(3);
    expect(sleeps).toEqual([500, 1000]);
  });

  it('gives up after the last attempt and rethrows', () => {
    const sleeps: number[] = [];
    const { fn } = failing(...Array.from({ length: 5 }, () => new Error('Backend Error')));
    expect(() => withRetry(fn, (ms) => sleeps.push(ms))).toThrow('Backend Error');
    expect(sleeps).toEqual([500, 1000, 2000, 4000]);
  });

  it('does not retry other errors', () => {
    const { fn, calls } = failing(new Error('Not Found'));
    expect(() => withRetry(fn, () => {})).toThrow('Not Found');
    expect(calls()).toBe(1);
  });
});

describe('isRetryable', () => {
  it.each([
    'Rate Limit Exceeded',
    'Calendar usage limits exceeded.',
    'API call to calendar.events.insert failed with error: Backend Error',
    'Request failed with code 503',
    'Quota exceeded for quota metric',
  ])('retries %j', (message) => {
    expect(isRetryable(new Error(message))).toBe(true);
  });

  it.each(['Not Found', 'Forbidden', 'Invalid value for: colorId', 'Event 5003 missing'])(
    'does not retry %j',
    (message) => {
      expect(isRetryable(new Error(message))).toBe(false);
    },
  );
});
