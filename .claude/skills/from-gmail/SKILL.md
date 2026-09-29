---
name: from-gmail
description: >-
  Add something from Lian's Gmail to the tars app (its list and calendar view).
  Triggers on: "add … from my email", "put the … booking/appointment in my
  calendar/todo", "make a task from that email", "add my … confirmation".
---

# From Gmail to the tars app

Lian names something in their email; find it, turn it into a todo task, add it.
The tars app's calendar view shows any task with a date, so "calendar" means the
tars app too. Timezone is **Europe/London**.

## Steps

1. **Find the email** with `bin/gmail search '<gmail query>' -n 10`, using Gmail
   syntax built from what Lian said (sender, subject words, `newer_than:60d`,
   `-category:promotions`). Pick the best match; if several fit equally, list
   them (date · sender · subject) and ask which.
2. **Read it** with `bin/gmail read <id>` and take only what the email states:
   - `title` — short and specific: what + who/where ("Dentist check-up — Smile Dental").
   - `due` — `YYYY-MM-DD` of the event or deadline.
   - `dueTime` — `HH:MM` 24h London time if the email gives a time, else `null`.
   - `description` — location/address, reference or booking numbers, anything
     to bring, then `From Gmail: <sender>, <email date>, "<subject>"`.
   Never guess a date or time. If the email has none, ask Lian (or add it
   without a due date if they say so).
3. **Check for a duplicate**: `curl -s http://127.0.0.1:8400/api/state`. If a
   not-`done` task already covers it (same thing, same date), don't add another;
   say it's already there, and offer to update it if details differ
   (`PATCH /api/tasks/<id>` with only the changed fields).
4. **Add it**:
   ```bash
   curl -s -X POST http://127.0.0.1:8400/api/tasks -H 'content-type: application/json' \
     -d '{"title": "…", "due": "YYYY-MM-DD", "dueTime": "HH:MM", "description": "…"}'
   ```
   Several items in one request (e.g. an itinerary): one task each.
5. **Confirm** in one line per task: `**Wed 1 Oct · 18:15** — <title>` and the
   link https://omarchy.tail0bf266.ts.net/

If `bin/gmail` says sign-in expired, follow the Gmail note in the root CLAUDE.md.
