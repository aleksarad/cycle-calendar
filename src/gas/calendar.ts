// Calendar adapter. CalendarApp finds or creates the dedicated calendar; the
// Calendar advanced service does all event work, because only it can set
// transparency and private extended properties (spec §5).

import { TAG_FILTER, type EventResource } from '../core/events';
import { withRetry } from '../core/retry';

const CALENDAR_ID_PROPERTY = 'calendarId';

const retry = <T>(fn: () => T): T => withRetry(fn, (ms) => Utilities.sleep(ms));

function events(): GoogleAppsScript.Calendar.Collection.EventsCollection {
  if (!Calendar) {
    throw new Error(
      'The Google Calendar advanced service is not enabled. In the Apps Script editor, ' +
        'add the "Google Calendar API" service under Services.',
    );
  }
  return Calendar.Events!;
}

/**
 * The dedicated calendar's ID. Prefers the ID saved for this spreadsheet, so a
 * renamed or duplicate-named calendar is still found; falls back to the name,
 * then creates it. Renames the calendar if the "Calendar name" setting changed.
 */
export function getOrCreateCalendar(name: string): string {
  const props = PropertiesService.getDocumentProperties();
  const savedId = props.getProperty(CALENDAR_ID_PROPERTY);

  const calendar =
    (savedId && CalendarApp.getCalendarById(savedId)) ||
    CalendarApp.getCalendarsByName(name).find((c) => c.isOwnedByMe()) ||
    CalendarApp.createCalendar(name, {
      summary: 'Estimated cycle phases, created by the Cycle Calendar spreadsheet.',
    });

  if (calendar.getName() !== name) calendar.setName(name);
  if (calendar.getId() !== savedId) props.setProperty(CALENDAR_ID_PROPERTY, calendar.getId());
  return calendar.getId();
}

/** The saved calendar ID, without creating anything. */
export function savedCalendarId(): string | null {
  return PropertiesService.getDocumentProperties().getProperty(CALENDAR_ID_PROPERTY);
}

/** Deletes every event the script created (and nothing else). Returns how many. */
export function deleteTaggedEvents(calendarId: string): number {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = retry(() =>
      events().list(calendarId, {
        privateExtendedProperty: TAG_FILTER,
        showDeleted: false,
        maxResults: 2500,
        pageToken,
      }),
    );
    for (const item of page.items ?? []) if (item.id) ids.push(item.id);
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken);

  for (const id of ids) retry(() => events().remove(calendarId, id));
  return ids.length;
}

/** Creates the events. Returns how many. */
export function insertEvents(calendarId: string, resources: EventResource[]): number {
  for (const resource of resources) {
    retry(() => events().insert(resource as GoogleAppsScript.Calendar.Schema.Event, calendarId));
  }
  return resources.length;
}
