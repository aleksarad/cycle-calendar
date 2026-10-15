// Global entry points. Everything exported here is emitted by scripts/build.mjs
// as a top-level function in dist/Code.js so Apps Script can call it from the
// menu, from triggers, and from the editor's function dropdown.

import { addMenu, toast } from './gas/menu';

export function onOpen(): void {
  addMenu();
}

export function setup(): void {
  toast('Set up is not implemented yet.');
}

export function syncNow(): void {
  toast('Sync is not implemented yet.');
}

export function onLogEdit(_e: GoogleAppsScript.Events.SheetsOnEdit): void {
  // Installable onEdit handler; wired up in a later phase.
}

export function dailySync(): void {
  // Time-driven handler; wired up in a later phase.
}

export function remove(): void {
  toast('Remove is not implemented yet.');
}
