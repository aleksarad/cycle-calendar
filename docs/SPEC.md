# Cycle Phase Calendar — Requirements

A Google Apps Script, bound to a Google Sheet, that reads a log of period start dates, predicts menstrual cycle phases, and writes them to a dedicated Google Calendar as color-coded, all-day events with general information in each description.

Primary user: the author (personal use). Secondary: anyone who copies the template Sheet from the public GitHub repo. This is also a portfolio project, so code quality, tests and documentation matter as much as features.

---

## 1. Principles

1. **No data collection.** No server, no analytics, no external network calls (`UrlFetchApp` must not be used). All data stays in the user's own Sheet, Script Properties and Calendar.
2. **Minimal permissions.** Declare OAuth scopes explicitly in `appsscript.json`; request only what is needed.
3. **Private by default.** Events go on a dedicated secondary calendar, never the primary one, so phases don't appear on a shared or work calendar.
4. **Estimates, not medical advice.** All copy uses "commonly reported" / "estimated" framing. Nothing implies diagnostic accuracy or suitability for contraception.
5. **Idempotent sync.** Running sync any number of times produces the same calendar state.

---

## 2. User flow

1. User copies the template Sheet ("File → Make a copy").
2. User opens the **Cycle Calendar** custom menu → **Set up**. This authorizes the script, creates the dedicated calendar if missing, and installs triggers.
3. User enters one or more period start dates in the **Log** tab.
4. The calendar syncs automatically on each log edit. **Sync now** is available in the menu at any time.

---

## 3. Sheet structure

### Tab: `Log`

| Column             | Content                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| A — `Period start` | One date per row, any order. Blank rows ignored. Duplicates ignored. Non-dates ignored and reported in Status. |

### Tab: `Settings` (key / value rows, with defaults)

| Setting                     | Default                                                 | Notes                                                                                |
| --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Default cycle length (days) | 28                                                      | Used when fewer than 2 start dates are logged                                        |
| Period length (days)        | 5                                                       | Menstrual phase length                                                               |
| Luteal length (days)        | 14                                                      | Used to estimate ovulation                                                           |
| Cycles to average           | 6                                                       | Most recent N intervals                                                              |
| Months ahead                | 6                                                       | Prediction window                                                                    |
| Calendar name               | Cycle Phases                                            | Dedicated calendar                                                                   |
| Phase titles (×4)           | 🌑 Menstrual / 🌒 Follicular / 🌕 Ovulatory / 🌘 Luteal | User-renamable. The emoji prefixes make phases easy to tell apart from other events. |
| Phase colors (×4)           | PALE_RED / PALE_GREEN / PALE_BLUE / MAUVE               | `CalendarApp.EventColor` names                                                       |

Invalid settings fall back to defaults and are reported in Status. Never throw on bad input.

### Tab: `Status` (written by the script, read-only for the user)

- Typical cycle length used (the median), and how many cycles it was based on
- Cycle range: shortest and longest of the cycles used, with a note when cycles are irregular (see §4.1)
- Excluded intervals (outliers) and why
- Next predicted period start
- Today's estimated phase and cycle day
- Last sync time and result (success / error message)
- Any input warnings

---

## 4. Cycle math (pure, no Apps Script globals)

### 4.1 Typical cycle length

Outliers are judged against the user's own history rather than fixed population limits, so someone whose normal cycle is 50 days is predicted correctly instead of having every cycle discarded.

1. Sort unique start dates ascending; compute intervals between consecutive dates.
2. **Plausibility bounds (always applied):** exclude intervals under **15** or over **90** days. Neither can be a single cycle; they come from an extra or mistyped date, or from several missed logs.
3. **Personal outliers:** the _window_ is the most recent **max(N, 3)** plausible intervals, where N is "Cycles to average". The minimum of 3 means a low N still has enough history to judge. Only intervals in the window are judged; older ones are neither excluded nor used, so a lasting change in cycle length (e.g. 28 → 40 days) doesn't flag the older, genuine cycles. Take the window's median `m`.
   - With **3 or more** intervals in the window, exclude any of them outside **0.75·m – 1.6·m** (bounds rounded to whole days, inclusive). Over 1.6·m usually means a missed log (two cycles counted as one). Under 0.75·m usually means an extra or mistyped date. For `m = 28` this gives 21–44, close to the old fixed range.
   - With **fewer than 3**, there's too little history to judge, so fall back to the fixed **21–45** range.
4. **Typical length = median** of the most recent N window intervals that remain, rounded to the nearest whole day (for an even count, the mean of the two middle values, with .5 rounding up). The median keeps one unusual cycle from dragging every prediction.
5. With no intervals left, use the default cycle length.
6. **Variability:** with 2 or more intervals used, report the shortest and longest. If `longest − shortest` is **more than 7 days**, the cycles count as **irregular**. Status says so, and predicted events say that dates could shift (see §5).

**Exclusion wording** stays neutral and never implies that a real cycle is wrong. For example, "45 days is longer than usual for you (typically 28), possibly a missed log, so it's left out of the estimate", or "10 days is too short to be a full cycle, possibly an extra or mistyped date".

### 4.2 Phase boundaries for a cycle of length `L` (day 1 = period start)

Anchor ovulation on the luteal phase, **not** on day 14:

- `ovulationDay = L − lutealLength`
- **Menstrual:** day 1 → `periodLength`
- **Follicular:** `periodLength + 1` → `ovulationDay − 2`
- **Ovulatory:** `ovulationDay − 1` → `ovulationDay + 1` (3 days)
- **Luteal:** `ovulationDay + 2` → `L`
  Physiologically the follicular phase begins on day 1 and overlaps menstruation. The calendar uses non-overlapping display phases for readability. Document this in the README.

**Edge cases:** if a short cycle or long period leaves follicular at ≤ 0 days, omit the follicular event and let the ovulatory phase start the day after menstruation ends. Concretely, ovulatory start is clamped to `max(ovulationDay − 1, periodLength + 1)` and its end stays at `ovulationDay + 1`. If that leaves the ovulatory phase at ≤ 0 days, render only menstrual (day 1 → `periodLength`) and luteal (`periodLength + 1` → `L`), and add a warning to Status. Never produce overlapping or negative-length events.

### 4.3 Schedule

- **Current cycle:** anchored on the most recent logged start, with the typical length (§4.1).
- **Future cycles:** repeat with the typical length until `today + monthsAhead`.
- **If today is past the predicted next start with no new log:** keep predicting from the predicted dates and show a "period may be late — log your start date" warning in Status.
- **Historical cycles** (before the most recent start) are out of scope for v1.

### 4.4 Dates and timezones

- Core logic works with **date-only values** (`YYYY-MM-DD` strings or a small date type), never JS `Date` with times.
- Convert from `Date` only when reading sheet cells, using the spreadsheet timezone (`Utilities.formatDate(cell, tz, 'yyyy-MM-dd')`). "Today" also comes from the spreadsheet timezone.
- The calendar boundary needs no `Date` at all: the advanced service takes all-day events as `start: { date: 'YYYY-MM-DD' }` / `end: { date: 'YYYY-MM-DD' }`.
- Tests must cover DST transitions and month/year boundaries.

---

## 5. Calendar output

- One **all-day, multi-day event per phase per cycle**, not one event per day.
- All-day event `end.date` is **exclusive**. Add one day to the last phase day.
- **Title:** phase title from Settings; append ` (predicted)` for cycles after the current one.
- **Color:** from Settings. Map the `CalendarApp.EventColor` name to its `colorId` (Google's 11 preset event colors; custom hex is not supported per event).
- **Show as free:** `transparency: 'transparent'`, so phases never block the user's availability in free/busy views.
- **Private:** `visibility: 'private'`.
- **Tag every created event** with `extendedProperties.private.cyclePhaseCalendar = 'v1'`. Sync only ever deletes tagged events, so anything the user adds manually to the calendar is safe.
  **API choice:** `CalendarApp` cannot set transparency. Use the **Calendar advanced service** (`Calendar.Events.insert` / `list` with `privateExtendedProperty` / `remove`) for all event operations. `CalendarApp` is fine for getting or creating the calendar itself.

### Sync algorithm

1. Get or create the dedicated calendar. Its ID is stored in Document Properties after creation, with lookup by name as the fallback, so duplicate names or renames don't break sync.
2. Delete **all** tagged events (`privateExtendedProperty` filter, no time bounds, paginated). Wiping and rebuilding means stale predictions (for example after a late or early period, or a shorter "Months ahead") can never survive, and sync is strictly idempotent. Past cycles are not kept on the calendar.
3. Create the newly computed events.
4. Write the result to Status.
   Must stay well under the Apps Script execution time limit for a 12-month window.

### Event description

Generated from a single editable content module (`src/content/phases.ts`):

- Cycle days covered (e.g. "Days 6–15 of an estimated 29-day cycle")
- What's generally happening hormonally (1–2 sentences)
- Commonly reported experiences: energy, mood, physical symptoms (short list)
- "Estimated from your last N cycles."
- **When cycles are irregular** (§4.1 step 6), on predicted cycles only: "Your recent cycles ranged from X to Y days, so these dates could shift."
- Footer: "General information, not medical advice. Not for contraception."
  The Ovulatory description must explicitly say the timing is an estimate.

---

## 6. Menu and triggers

**Custom menu** (`onOpen`) — **Cycle Calendar**:

- **Set up**: authorize, create calendar, install triggers (idempotent; never duplicates triggers)
- **Sync now**
- **Remove**: delete triggers and all tagged events, with a confirm dialog. Leaves the calendar itself for the user to delete. Status records the removal and how to turn syncing back on.
  **Triggers:**
- Installable `onEdit` trigger, because simple `onEdit` triggers can't access CalendarApp. Sync only when the edit is in the `Log` or `Settings` tab.
- Daily time-based trigger (around 3am in the spreadsheet's timezone) that runs a sync, so the prediction window keeps rolling forward and Status (today's phase, late warning) stays current without edits.
- Guard against rapid successive edits with `LockService` so concurrent syncs can't duplicate events. Requests are **coalesced**: each one marks a sync as pending, and whoever holds the lock keeps syncing (at most 3 times in a row) until nothing is pending. An edit that arrives mid-sync is therefore picked up, never lost, and a burst of edits becomes one or two syncs.

---

## 7. Permissions (`appsscript.json`)

Declare explicitly:

- `https://www.googleapis.com/auth/spreadsheets.currentonly`
- `https://www.googleapis.com/auth/calendar` (CalendarApp needs this to create a calendar)
- `https://www.googleapis.com/auth/script.container.ui`
- `https://www.googleapis.com/auth/script.scriptapp` (installable triggers)
  No other scopes. Enable the **Calendar advanced service** (v3) under `dependencies.enabledAdvancedServices`. It uses the same calendar scope.

---

## 8. Tech stack and structure

- **TypeScript**, developed locally, deployed with **clasp**.
- **Bundler** (esbuild or rollup) producing a single script file. Apps Script has no ES modules, and entry points (`onOpen`, `setup`, `syncNow`, `onLogEdit`, `dailySync`, `remove`) must end up as **top-level global functions**. Verify they appear in the Apps Script editor's function dropdown.
- **Tests:** Jest or Vitest on the core module only.
- **Lint/format:** ESLint + Prettier.

```
src/
  core/        # pure logic — no Apps Script globals
    types.ts
    dates.ts
    cycle.ts       # stats + phase schedule
  content/
    phases.ts      # descriptions, symptom copy, disclaimer
  gas/         # thin Apps Script adapters
    sheet.ts       # read Log/Settings, write Status
    calendar.ts    # get/create calendar, delete tagged, create events
    triggers.ts
    menu.ts
  main.ts      # global entry points
tests/
  cycle.test.ts
  dates.test.ts
appsscript.json
```

---

## 9. Test cases (core)

- Typical length from 6+ regular cycles; from exactly 2 starts; fallback with 0–1 starts
- Median, not mean: one long cycle among regular ones doesn't move the prediction
- Plausibility bounds: intervals under 15 or over 90 days are always excluded
- Personal outliers: with 3+ intervals, a missed log (≈2·m) and an extra log (≈0.5·m) are excluded and reported
- Consistently long cycles (e.g. 50 days) are kept and predicted, not discarded
- With fewer than 3 intervals, the fixed 21–45 range applies (e.g. 14 and 60 days excluded)
- Variability: shortest/longest reported; a range over 7 days is flagged irregular; exactly 7 is not
- Irregular note appears on predicted cycles only
- Unsorted and duplicate dates handled
- Phase boundaries for 21, 28, 35 and 45-day cycles
- Short cycle + long period edge case (no overlap, no negative lengths)
- Exclusive end-date conversion
- DST change, month and year boundaries
- Late-period detection
- Invalid settings fall back to defaults

---

## 10. Repo deliverables

- `README.md`:
  - Overview with a screenshot/GIF placeholder
  - Setup for non-technical users (template copy) and developers (clasp)
  - How the predictions work
  - **Design decisions:** luteal-anchored math, median cycle length with outliers judged against the user's own history (and why fixed population ranges were rejected), private calendar, one event per phase, events shown as free/private, tagged events, no data collection. Also note that one calendar per phase (which would allow custom hex colors) was considered and rejected in favor of a single easy toggle, with emoji prefixes used for distinction instead.
  - Honest privacy statement: nothing leaves your Google account and the author sees nothing, but the events do live in Google Calendar under Google's terms
  - Health disclaimer
- `LICENSE` (MIT)
- npm scripts: `build`, `test`, `lint`, `push` (build + clasp push)
- Commit history that reflects incremental work

---

## 11. Out of scope for v1

Symptom logging or personalized symptoms, HealthKit / Health Connect / app imports, web app or multi-user hosting, notifications, historical-cycle rendering, fertility or contraception features.

Possible later: rendering past cycles, a symptom notes column that stays in the user's own Sheet.

---

## 12. Suggested build order

1. Scaffold: TS, bundler, clasp, lint, test setup; confirm a hello-world global function deploys.
2. Core date + cycle logic with full tests.
3. Phase content module.
4. Sheet adapters (read Log/Settings, write Status).
5. Calendar adapter + sync algorithm.
6. Menu, setup, triggers, lock, remove.
7. Manual end-to-end test on the author's own account.
8. README, license, screenshots.

---

## 13. Acceptance criteria

- Running **Set up** then logging two start dates creates correctly colored, emoji-titled, non-overlapping phase events for the next 6 months on a calendar named "Cycle Phases".
- Every event shows as free and private.
- Logging a new date updates the calendar automatically, with no duplicates.
- Manually created events on that calendar are never touched.
- **Remove** cleans up triggers and all script-created events.
- All core tests pass; no `UrlFetchApp` anywhere in the codebase.
