// What each menu item and trigger does. src/main.ts exposes these as globals.

import { parseSettings } from './core/settings';
import { deleteTaggedEvents, findCalendar } from './gas/calendar';
import { MENU_NAME, confirm, toast } from './gas/menu';
import {
  LOG_TAB,
  SETTINGS_TAB,
  ensureTabs,
  formatNow,
  readSettingsValues,
  spreadsheet,
  writeStatus,
} from './gas/sheet';
import {
  clearPendingSync,
  installTriggers,
  removeTriggers,
  syncWithLock,
  withDocumentLock,
} from './gas/triggers';
import { runSync } from './sync';

/** How long a menu action waits for a running sync before giving up. */
const MENU_WAIT_MS = 30_000;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Syncs under the lock and reports the result in a toast. */
function syncAndReport(prefix: string): void {
  let created = 0;
  const runs = syncWithLock(() => {
    const result = runSync();
    created = result.ok ? (result.eventsCreated ?? 0) : 0;
  }, MENU_WAIT_MS);
  toast(
    runs
      ? `${prefix}${plural(created, 'event')} on your calendar. See the Status tab.`
      : 'A sync is already running and will include your latest changes.',
  );
}

export function setupCommand(): void {
  const ss = spreadsheet();
  ensureTabs(ss);
  installTriggers(ss);
  syncAndReport('Set up complete. Automatic sync is on. ');
}

export function syncNowCommand(): void {
  syncAndReport('Synced ');
}

/** Installable onEdit: only edits to Log or Settings matter. */
export function editCommand(e: GoogleAppsScript.Events.SheetsOnEdit): void {
  const tab = e.range.getSheet().getName();
  if (tab !== LOG_TAB && tab !== SETTINGS_TAB) return;
  // Don't wait: if a sync is running, it picks this edit up.
  syncWithLock(runSync, 0);
}

export function dailyCommand(): void {
  syncWithLock(runSync, 0);
}

export function removeCommand(): void {
  const ss = spreadsheet();
  const { calendarName } = parseSettings(readSettingsValues(ss)).settings;

  const confirmed = confirm(
    `Remove ${MENU_NAME}?`,
    `This turns off automatic syncing and deletes every event this spreadsheet created on ` +
      `the "${calendarName}" calendar. Events you added yourself, the calendar itself, and ` +
      `this spreadsheet's data are kept.`,
  );
  if (!confirmed) return;

  const triggers = removeTriggers();
  const events = withDocumentLock(() => {
    clearPendingSync();
    const calendar = findCalendar(calendarName);
    return calendar ? deleteTaggedEvents(calendar.getId()) : 0;
  }, MENU_WAIT_MS);

  writeStatus(ss, [
    [MENU_NAME, `Removed ${formatNow(ss)}. Automatic syncing is off.`],
    ['Deleted', `${plural(events, 'event')} and ${plural(triggers, 'trigger')}`],
    ['To turn it back on', `Use ${MENU_NAME} → Set up.`],
  ]);
  toast(
    `Removed ${plural(events, 'event')}. You can delete the "${calendarName}" calendar in ` +
      'Google Calendar settings.',
  );
}
