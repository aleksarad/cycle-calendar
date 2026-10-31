// Coalesces sync requests so rapid edits can't run overlapping syncs (which
// could duplicate events) and the last edit is never lost.
//
// Every request marks a sync as pending, then tries to take the lock. The lock
// holder keeps syncing while requests are pending, so an edit that arrives
// mid-sync is picked up by the sync already running. Requests that can't get
// the lock just leave their mark and return.

export interface CoalesceDeps {
  markPending(): void;
  /** Returns true, and clears the mark, if a sync is pending. */
  takePending(): boolean;
  tryLock(): boolean;
  releaseLock(): void;
}

/** Caps back-to-back runs so a steady stream of edits can't hit the execution time limit. */
export const MAX_RUNS = 3;

/** Returns how many times `run` was called: 0 means another sync holds the lock and will pick this request up. */
export function runCoalesced(run: () => void, deps: CoalesceDeps, maxRuns = MAX_RUNS): number {
  deps.markPending();
  if (!deps.tryLock()) return 0;
  let runs = 0;
  try {
    while (runs < maxRuns && deps.takePending()) {
      runs++;
      run();
    }
  } finally {
    deps.releaseLock();
  }
  return runs;
}
