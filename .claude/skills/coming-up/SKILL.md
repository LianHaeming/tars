---
name: coming-up
description: >-
  Answer "do I have anything coming up?" and similar questions (what's coming
  up, what's on this week, upcoming appointments/bookings/deadlines, am I
  forgetting anything) by scanning Lian's Gmail for future-dated commitments and
  cross-referencing the tars app. Triggers on: "coming up", "what's on",
  "upcoming", "anything this week/soon", "appointments", "what have I got".
---

# Coming up

Lian asks this from a Remote Control session to get a quick, trustworthy read on
what's ahead. Answer it by pulling from Gmail (primary) and the tars app, then
present a single chronological list. Timezone is **Europe/London**.

## Sources

1. **Gmail** — `bin/gmail search '<gmail query>' -n 25` lists matches (id, date,
   sender, subject, snippet); `bin/gmail read <id>` shows one message in full.
2. **Todo app** — `GET http://127.0.0.1:8400/api/state` returns `{ tasks, projects }`.
   Tasks have `title`, `due` (`YYYY-MM-DD`), `dueTime` (`HH:MM` or null),
   `description`, `done`. Include not-`done` tasks with a `due` of today or later.
3. **Expected payments** — `curl -s http://127.0.0.1:8400/api/expected` lists repeating Monzo payments and income
   predicted from history (`date`, `name`, `amount` in pence — negative is money out, `kind`, `varies`, `late`).
   Include bills/direct debits and income in the list, marked as expected.
4. **Google Calendar** — if the calendar connector tools are present in the
   session, list events for the next ~2 weeks too. If not present, skip silently.

## How to answer

1. Search Gmail for recent mail that implies a future commitment, using Gmail
   query syntax (not natural language). Lian's inbox is heavy with marketing and order/delivery
   spam, so favour precise queries over broad keyword ORs:
   - `newer_than:45d (category:reservations OR appointment OR booking OR consultation OR reservation OR itinerary OR "e-ticket" OR "your ticket" OR "your booking") -category:promotions`
   - `is:important newer_than:30d -category:promotions` as a focused sweep.
   Read only the promising messages (`bin/gmail read <id>`) to extract what it is, the
   date, the time and the location. Ignore: promotions, sale/discount blasts,
   "order confirmed"/"dispatched"/"delivered" retail mail, and newsletters —
   these are noise, not commitments (a *theatre/travel/appointment* booking is a
   commitment; an Amazon/New Look order is not).
2. Pull todo-app tasks with due dates (and calendar events if available).
3. Keep only items dated **today or later** (London time). Drop anything already
   past, already `done`, or clearly not a real commitment (newsletters, promos).
4. De-duplicate: an appointment that's both an email and a todo task is one item
   — merge them, note it's already tracked.

## Output

A short chronological list, soonest first. One line per item:

> **Wed 1 Oct · 18:15** — LVC surgeon consultation (Prof Reinstein), 138 Harley St · *in todo + confirmation email*

Group by "This week" / "Later" if the list is long. Lead with the very next
thing. If an email looks actionable but isn't yet in the tars app, say so and
offer to add it (via `POST http://127.0.0.1:8400/api/tasks` with
`{title, due, dueTime, description}`) — don't add it unprompted.

Be honest about coverage: you scanned recent email + the todo list, so say that.
If nothing turns up, say it's clear and mention the window you checked.
