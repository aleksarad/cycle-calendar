export const MENU_NAME = 'Cycle Calendar';

/** Adds the Cycle Calendar menu. Item handlers are referenced by global function name. */
export function addMenu(): void {
  SpreadsheetApp.getUi()
    .createMenu(MENU_NAME)
    .addItem('Set up', 'setup')
    .addItem('Sync now', 'syncNow')
    .addSeparator()
    .addItem('Remove', 'remove')
    .addToUi();
}

export function toast(message: string): void {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, MENU_NAME);
}
