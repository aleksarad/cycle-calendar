// Global entry points. Everything exported here is emitted by scripts/build.mjs
// as a top-level function in dist/Code.js so Apps Script can call it from the
// menu, from triggers, and from the editor's function dropdown.
// Menu item and trigger names refer to these by string (gas/menu.ts, gas/triggers.ts).

import { dailyCommand, editCommand, removeCommand, setupCommand, syncNowCommand } from './commands';
import { addMenu } from './gas/menu';

export function onOpen(): void {
  addMenu();
}

export function setup(): void {
  setupCommand();
}

export function syncNow(): void {
  syncNowCommand();
}

export function onLogEdit(e: GoogleAppsScript.Events.SheetsOnEdit): void {
  editCommand(e);
}

export function dailySync(): void {
  dailyCommand();
}

export function remove(): void {
  removeCommand();
}
