// Spreadsheet adapter: creates the tabs, reads Log and Settings, writes Status.
// No decisions here. Values go to src/core as plain data.

import { EVENT_COLOR_IDS } from '../core/colors';
import { SETTING_ROWS } from '../core/settings';
import type { ISODate } from '../core/types';

type Sheet = GoogleAppsScript.Spreadsheet.Sheet;
type Spreadsheet = GoogleAppsScript.Spreadsheet.Spreadsheet;

export const LOG_TAB = 'Log';
export const SETTINGS_TAB = 'Settings';
export const STATUS_TAB = 'Status';

const LOG_HEADER = 'Period start';
const SETTINGS_HEADER = ['Setting', 'Value', 'Notes'];

export function spreadsheet(): Spreadsheet {
  return SpreadsheetApp.getActiveSpreadsheet();
}

export function timeZone(ss: Spreadsheet): string {
  return ss.getSpreadsheetTimeZone();
}

export function formatToday(ss: Spreadsheet): ISODate {
  return Utilities.formatDate(new Date(), timeZone(ss), 'yyyy-MM-dd') as ISODate;
}

export function formatNow(ss: Spreadsheet): string {
  return Utilities.formatDate(new Date(), timeZone(ss), 'yyyy-MM-dd HH:mm');
}

function getOrCreateSheet(ss: Spreadsheet, name: string): { sheet: Sheet; created: boolean } {
  const existing = ss.getSheetByName(name);
  return existing
    ? { sheet: existing, created: false }
    : { sheet: ss.insertSheet(name), created: true };
}

function setUpLog(sheet: Sheet): void {
  sheet.getRange('A1').setValue(LOG_HEADER).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet
    .getRange('A2:A')
    .setNumberFormat('yyyy-mm-dd')
    .setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireDate()
        .setAllowInvalid(true)
        .setHelpText('Enter the first day of a period, e.g. 2026-10-01.')
        .build(),
    );
  sheet.setColumnWidth(1, 140);
}

/** Adds any Settings rows that are missing, with defaults. Existing values are never changed. */
function setUpSettings(sheet: Sheet, created: boolean): void {
  if (created) {
    sheet.getRange(1, 1, 1, SETTINGS_HEADER.length).setValues([SETTINGS_HEADER]);
    sheet.getRange(1, 1, 1, SETTINGS_HEADER.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const lastRow = sheet.getLastRow();
  const existing = new Set(
    lastRow > 1
      ? sheet
          .getRange(2, 1, lastRow - 1, 1)
          .getValues()
          .map(([label]) => String(label).trim())
      : [],
  );
  const missing = SETTING_ROWS.filter((row) => !existing.has(row.label));
  if (!missing.length) return;

  const start = lastRow + 1;
  sheet
    .getRange(start, 1, missing.length, 3)
    .setValues(missing.map((row) => [row.label, row.defaultValue, row.note]));

  const colorRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(EVENT_COLOR_IDS), true)
    .setAllowInvalid(true)
    .build();
  missing.forEach((row, i) => {
    if (row.isColor) sheet.getRange(start + i, 2).setDataValidation(colorRule);
  });

  sheet.getRange(start, 3, missing.length, 1).setFontColor('#666666');
  sheet.autoResizeColumns(1, 2);
}

function setUpStatus(sheet: Sheet): void {
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  if (!protections.length) {
    sheet.protect().setDescription('Written by Cycle Calendar').setWarningOnly(true);
  }
}

/** Creates the Log, Settings and Status tabs if missing. Safe to run any number of times. */
export function ensureTabs(ss: Spreadsheet): void {
  const log = getOrCreateSheet(ss, LOG_TAB);
  if (log.created) setUpLog(log.sheet);

  const settings = getOrCreateSheet(ss, SETTINGS_TAB);
  setUpSettings(settings.sheet, settings.created);

  setUpStatus(getOrCreateSheet(ss, STATUS_TAB).sheet);
}

/**
 * Column A of the Log tab below the header. Date cells become `YYYY-MM-DD` in
 * the spreadsheet's timezone; other values are returned as-is for core to judge.
 */
export function readLogValues(ss: Spreadsheet): unknown[] {
  const sheet = ss.getSheetByName(LOG_TAB);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const tz = timeZone(ss);
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .map(([value]) =>
      value instanceof Date
        ? isNaN(value.getTime())
          ? String(value)
          : Utilities.formatDate(value, tz, 'yyyy-MM-dd')
        : value,
    );
}

/** The Settings tab as label → value. Rows without a label are skipped. */
export function readSettingsValues(ss: Spreadsheet): Record<string, unknown> {
  const sheet = ss.getSheetByName(SETTINGS_TAB);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const raw: Record<string, unknown> = {};
  for (const [label, value] of sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues()) {
    const key = String(label).trim();
    if (key) raw[key] = value;
  }
  return raw;
}

export function writeStatus(ss: Spreadsheet, rows: string[][]): void {
  const sheet = getOrCreateSheet(ss, STATUS_TAB).sheet;
  sheet.clearContents();
  if (!rows.length) return;
  sheet.getRange(1, 1, rows.length, 2).setValues(rows).setVerticalAlignment('top');
  sheet.getRange(1, 1, rows.length, 1).setFontWeight('bold');
  sheet.getRange(1, 2).setFontStyle('italic').setFontColor('#666666');
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 640);
  sheet.getRange(1, 2, rows.length, 1).setWrap(true);
}
