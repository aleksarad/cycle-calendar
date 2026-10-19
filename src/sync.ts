// Read the sheet → compute the schedule → (calendar, next phase) → write Status.

import { buildSchedule, type Schedule } from './core/cycle';
import { parseLogValues } from './core/log';
import { DEFAULT_SETTINGS, parseSettings } from './core/settings';
import { buildStatusRows, type SyncResult } from './core/status';
import type { Settings } from './core/types';
import {
  ensureTabs,
  formatNow,
  formatToday,
  readLogValues,
  readSettingsValues,
  spreadsheet,
  writeStatus,
} from './gas/sheet';

/** Runs a full sync and records the outcome on the Status tab. Rethrows on failure. */
export function runSync(): SyncResult {
  const ss = spreadsheet();
  const today = formatToday(ss);
  let schedule: Schedule | null = null;
  let settings: Settings = DEFAULT_SETTINGS;
  let inputWarnings: string[] = [];
  let result: SyncResult;

  try {
    ensureTabs(ss);
    const parsedSettings = parseSettings(readSettingsValues(ss));
    const log = parseLogValues(readLogValues(ss));
    settings = parsedSettings.settings;
    inputWarnings = [...parsedSettings.warnings, ...log.warnings];
    schedule = buildSchedule(log.dates, settings, today);
    result = { ok: true };
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  writeStatus(
    ss,
    buildStatusRows({ schedule, settings, inputWarnings, today, syncedAt: formatNow(ss), result }),
  );
  if (!result.ok) throw new Error(result.error);
  return result;
}
