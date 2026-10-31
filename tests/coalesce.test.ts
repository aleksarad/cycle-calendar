import { describe, expect, it } from 'vitest';
import { MAX_RUNS, runCoalesced, type CoalesceDeps } from '../src/core/coalesce';

/** In-memory stand-ins for Document Properties and LockService. */
function fakeEnvironment() {
  const state = { pending: false, locked: false };
  const deps: CoalesceDeps = {
    markPending: () => void (state.pending = true),
    takePending: () => {
      const was = state.pending;
      state.pending = false;
      return was;
    },
    tryLock: () => (state.locked ? false : (state.locked = true)),
    releaseLock: () => void (state.locked = false),
  };
  return { state, deps };
}

describe('runCoalesced', () => {
  it('runs once for a single request and releases the lock', () => {
    const { state, deps } = fakeEnvironment();
    let syncs = 0;
    expect(runCoalesced(() => syncs++, deps)).toBe(1);
    expect(syncs).toBe(1);
    expect(state).toEqual({ pending: false, locked: false });
  });

  it('leaves the request pending when another sync holds the lock', () => {
    const { state, deps } = fakeEnvironment();
    state.locked = true;
    let syncs = 0;
    expect(runCoalesced(() => syncs++, deps)).toBe(0);
    expect(syncs).toBe(0);
    expect(state.pending).toBe(true);
  });

  it('picks up an edit that arrives during a sync, so it is never lost', () => {
    const { deps } = fakeEnvironment();
    let syncs = 0;
    let editDuringFirstSync = true;
    const runs = runCoalesced(() => {
      syncs++;
      if (editDuringFirstSync) {
        editDuringFirstSync = false;
        // A second edit's trigger fires mid-sync: it can't get the lock, so it just marks pending.
        expect(runCoalesced(() => syncs++, deps)).toBe(0);
      }
    }, deps);
    expect(runs).toBe(2);
    expect(syncs).toBe(2);
  });

  it('merges many edits during one sync into a single follow-up', () => {
    const { deps } = fakeEnvironment();
    let first = true;
    const runs = runCoalesced(() => {
      if (!first) return;
      first = false;
      for (let i = 0; i < 5; i++) runCoalesced(() => {}, deps);
    }, deps);
    expect(runs).toBe(2);
  });

  it(`stops after ${MAX_RUNS} back-to-back runs`, () => {
    const { state, deps } = fakeEnvironment();
    const runs = runCoalesced(() => deps.markPending(), deps);
    expect(runs).toBe(MAX_RUNS);
    expect(state.locked).toBe(false);
  });

  it('releases the lock and rethrows when a sync fails', () => {
    const { state, deps } = fakeEnvironment();
    expect(() =>
      runCoalesced(() => {
        throw new Error('Calendar quota exceeded');
      }, deps),
    ).toThrow('Calendar quota exceeded');
    expect(state.locked).toBe(false);
  });
});
