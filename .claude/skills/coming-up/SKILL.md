---
name: coming-up
description: >-
  Answer "do I have anything coming up?" and similar questions (what's coming
  up, what's on this week, upcoming appointments/bookings/deadlines, am I
  forgetting anything) by scanning Lian's Gmail for future-dated commitments and
  cross-referencing the todo app. Triggers on: "coming up", "what's on",
  "upcoming", "anything this week/soon", "appointments", "what have I got".
---

# Coming up

Lian asks this from a Remote Control session to get a quick, trustworthy read on
what's ahead. Answer it by pulling from Gmail (primary) and the todo app, then
present a single chronological list. Timezone is **Europe/London**.

## Sources

1. **Gmail** — via the claude.ai Gmail connector tools already available in the
   session (`mcp__claude_ai_Gmail__search_threads`, `…__get_thread`,
   `…__get_message`). No setup/OAuth needed; the connector is Lian's account.
2. **Todo app** — `GET http://127.0.0.1:8788/api/state` returns `{ tasks, projects }`.
   Tasks have `title`, `due` (`YYYY-MM-DD`), `dueTime` (`HH:MM` or null),
   `description`, `done`. Include not-`done` tasks with a `due` of today or later.
3. **Google Calendar** — if the calendar connector tools are present in the
   session, list events for the next ~2 weeks too. If not present, skip silently.

## How to answer

1. Search Gmail for recent mail that implies a future commitment. Run a few
   targeted searches rather than reading the whole inbox, e.g.:
   - `newer_than:45d (appointment OR booking OR confirmed OR reservation OR itinerary OR "your order" OR invoice OR "due" OR consultation)`
   - `newer_than:14d in:inbox` as a general sweep.
   Read only the promising threads to extract: what it is, date, time, location.
2. Pull todo-app tasks with due dates (and calendar events if available).
3. Keep only items dated **today or later** (London time). Drop anything already
   past, already `done`, or clearly not a real commitment (newsletters, promos).
4. De-duplicate: an appointment that's both an email and a todo task is one item
   — merge them, note it's already tracked.

## Output

A short chronological list, soonest first. One line per item:

> **Wed 1 Oct · 18:15** — LVC surgeon consultation (Prof Reinstein), 138 Harley St · *in todo + confirmation email*

Group by "This week" / "Later" if the list is long. Lead with the very next
thing. If an email looks actionable but isn't yet in the todo app, say so and
offer to add it (via `POST http://127.0.0.1:8788/api/tasks` with
`{title, due, dueTime, description}`) — don't add it unprompted.

Be honest about coverage: you scanned recent email + the todo list, so say that.
If nothing turns up, say it's clear and mention the window you checked.
