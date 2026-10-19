# Cycle Phase Calendar

Google Apps Script (TypeScript, bundled with esbuild, deployed with clasp) bound to a Google Sheet. It predicts menstrual cycle phases from logged period start dates and writes them to a dedicated Google Calendar. The full requirements are in docs/SPEC.md and are the source of truth. Update the spec when a decision changes it.

## Commands

- `npm run build`: bundle src → dist/Code.js and copy appsscript.json
- `npm test`: Vitest. Core tests run twice, in America/New_York and Australia/Sydney (one zone behind UTC, one ahead), to catch local-time bugs; the bundle guard runs once.
- `npm run lint` / `npm run typecheck` / `npm run format`
- `npm run push`: build + clasp push. **Ask before running.** It deploys to the user's Google account.

## Architecture rules

- `src/core/` and `src/content/` are pure: no Apps Script globals (SpreadsheetApp, CalendarApp, Calendar, Utilities, Session, …). ESLint enforces this. All logic and decisions live here and get unit tests.
- `src/gas/` holds thin adapters with no business logic.
- tsconfig `lib` is pinned to ES2020 as a conservative bound on Apps Script's V8 runtime. Don't raise it to get newer APIs (for example `Array.prototype.at`).
- `src/main.ts` holds only top-level entry points. Each one must survive bundling as a top-level `function` declaration (the bundle test checks this). Trigger handlers are referenced by name string, so renaming one means also updating triggers.ts.
- Dates in core are `YYYY-MM-DD` strings (`ISODate`). Only `src/core/dates.ts` touches `Date`, and only through UTC methods. Do date math with its helpers, never with `new Date(y, m, d)` or local getters. Sheet cells are converted with the spreadsheet timezone. Calendar all-day events take `{date: 'YYYY-MM-DD'}`, and the end date is exclusive.

## Hard constraints

- Never use `UrlFetchApp` or any network call. No analytics. A test enforces this.
- Don't add OAuth scopes beyond the four in appsscript.json.
- Use the Calendar advanced service (`Calendar.Events.*`) for events. CalendarApp is only for getting or creating the calendar.
- Sync deletes only events tagged `extendedProperties.private.cyclePhaseCalendar = 'v1'`. Never delete untagged events.
- Settings and log parsing never throw. Fall back to defaults and add a Status warning.
- User-facing copy says "estimated" or "commonly reported", never implies medical accuracy, and never mentions contraception suitability.

## Workflow

- Build in phases (scaffold → core → content → sheet → calendar/sync → menu/triggers → manual E2E → README) and keep commits small and incremental (the commit history is part of the portfolio).
- Write tests first for core logic.
- Don't commit .clasp.json (it contains a personal scriptId).
