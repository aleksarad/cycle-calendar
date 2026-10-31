// Installable triggers and the sync lock.
//
// Handlers are referenced by global function name: these must match the
// exports in src/main.ts (the bundle test checks those names exist).

import { runCoalesced } from '../core/coalesce';

export const EDIT_HANDLER = 'onLogEdit';
export const DAILY_HANDLER = 'dailySync';
const HANDLERS = [EDIT_HANDLER, DAILY_HANDLER];
const DAILY_HOUR = 3;

const PENDING_PROPERTY = 'syncPending';

type Spreadsheet = GoogleAppsScript.Spreadsheet.Spreadsheet;

function triggersFor(handler: string): GoogleAppsScript.Script.Trigger[] {
  return ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === handler);
}

/** Installs the edit and daily triggers if missing, and removes any duplicates. Idempotent. */
export function installTriggers(ss: Spreadsheet): void {
  for (const handler of HANDLERS) {
    const [first, ...duplicates] = triggersFor(handler);
    duplicates.forEach((t) => ScriptApp.deleteTrigger(t));
    if (first) continue;

    const builder = ScriptApp.newTrigger(handler);
    if (handler === EDIT_HANDLER) {
      // Installable, not simple: simple onEdit triggers can't use CalendarApp.
      builder.forSpreadsheet(ss).onEdit().create();
    } else {
      builder
        .timeBased()
        .everyDays(1)
        .atHour(DAILY_HOUR)
        .inTimezone(ss.getSpreadsheetTimeZone())
        .create();
    }
  }
}

/** Deletes this project's sync triggers. Returns how many. */
export function removeTriggers(): number {
  const triggers = HANDLERS.flatMap(triggersFor);
  triggers.forEach((t) => ScriptApp.deleteTrigger(t));
  return triggers.length;
}

/** Runs `fn` while holding the document lock, waiting up to `waitMs` for it (throws on timeout). */
export function withDocumentLock<T>(fn: () => T, waitMs: number): T {
  const lock = LockService.getDocumentLock();
  lock.waitLock(waitMs);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** Drops any pending sync request, e.g. after Remove. */
export function clearPendingSync(): void {
  PropertiesService.getDocumentProperties().deleteProperty(PENDING_PROPERTY);
}

/**
 * Runs `sync` under the document lock, coalescing concurrent requests.
 * Returns 0 if another sync is running; that sync will include this request.
 */
export function syncWithLock(sync: () => void, waitMs: number): number {
  const props = PropertiesService.getDocumentProperties();
  const lock = LockService.getDocumentLock();
  return runCoalesced(sync, {
    markPending: () => props.setProperty(PENDING_PROPERTY, String(Date.now())),
    takePending: () => {
      const pending = props.getProperty(PENDING_PROPERTY) !== null;
      if (pending) props.deleteProperty(PENDING_PROPERTY);
      return pending;
    },
    tryLock: () => lock.tryLock(waitMs),
    releaseLock: () => lock.releaseLock(),
  });
}
