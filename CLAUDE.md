# tars

Lian's personal assistant app on the Omarchy PC (`~/tars`). Lian starts Claude here and usually drives it with
Remote Control from their phone or iPad, and uses the app on their phone over Tailscale at
**https://omarchy.tail0bf266.ts.net/**. One private repo: github.com/LianHaeming/tars (Mac clone: `~/dev/tars`).

(Separate from robin, Lian's planner/notes toolbox on the Mac.)

## Layout
One data folder, one server, one React frontend.

```
data/            all data — only the server reads or writes it
  food/          Food content: menu.json, r/<id>.json, sainsburys/ocado.json, photos/ (in git; published from the Mac)
  state/         live data (PC only, gitignored): tasks.json (lists + tasks), food.json (basket, shop), chat.json (Tars), money.json (AI labels + insights)
app/
  server/        Node, no dependencies: index.js (routes + static), store.js (data/state docs), ask.js (Tars chat), money.js (Monzo), claude.js (shared `claude` CLI runner for ask/burmese/money), burmese.js (deck, progress, translator)
  web/           React + TypeScript + Vite + Tailwind v4 + shadcn/ui — display only, everything via /api
  app.json       service config for bin/up (build → app/dist/, start → node server)
bin/             sync, up, backup, gmail, monzo, burmese (rebuilds the deck — stop the service first), email-tasks
```

- **The app** (Lian's phone, over Tailscale): two tabs. **Schedule** (`/`) — a flat **"Life, so far"** strip, then a
  sticky row of list filter labels (All + one per list in the list's colour, + Completed; choice kept in browser
  storage; on scroll the strip slides up behind the Dynamic Island while the filters lock to the top), **Upcoming**
  grouped by day (next 14 days only, then an "N more · See Month" link; Overdue first; expected Monzo payments mixed in
  as teal Money rows with a Money filter label; today's next timed task is a highlighted "main event" pill that expands
  in place for notes / Mark done / Edit), then **To-do · no date**. Rows show the list as a coloured tag under All.
  **Apps** (`/apps`) — one flat multi-app page: a sticky filter (All / Food / Burmese / Money — All shows every section,
  each tab shows just one; choice kept in browser storage) over titled sections for **Food** (menu search + recipe
  carousels + shopping-list link), **Burmese** (daily practice of a 100-sentence deck in both directions with spaced repetition — 3 new a day, phonetic first;
  a quick English → Burmese translator that can add a sentence to the deck; learned list) and **Money** (a small dashboard, not a
  Monzo copy: balance line, "goes out automatically every month" total split by group, Claude's "Tars noticed" insights,
  the repeating payments by group with logos, next 30 days); the Email review card sits
  atop the All view when there are candidates. Dock (on Schedule, Apps and app pages, not `/tars`): round **Add task**
  button, centred Schedule | Apps pill (Apps stays lit on app pages), round **Tars** (chat) button. Safari's status strip
  is `theme-color` = `--chrome` (#15263a) — keep them equal so the top reads as one navy surface; added to the Home
  Screen it runs standalone (manifest) under the Dynamic Island. Everything else is a **page** with its own URL and a
  back button (app pages go back to `/apps`) — Lian doesn't want pop-up windows: `/tars`, `/inbox`, `/food/:id`,
  `/food/list`. Legacy `/money`, `/food`, `/burmese`, `/month` now just redirect to their home (`/apps` or `/`).
  "Todo"/"calendar" = this app.
- **API** (`app/server/index.js`): `GET /api/state` · `POST|PATCH|DELETE /api/tasks[/id]` · `/api/projects[/id]` (a project PATCH with `subs` sets its sub-categories; tasks carry an optional `subId`) ·
  `POST /api/shopping {items}` (replaces the Shopping list's unticked items) · `GET|PATCH /api/food {basket, shop}` ·
  `GET|DELETE /api/chat` · `POST /api/ask {message}` (runs `claude -p` in `~/tars`, streams NDJSON text/status/error/done,
  saves the conversation in chat.json; read-only tools + `bin/gmail` + curl to the API, never edits code) ·
  `GET /api/money[/fresh]` (runs `bin/monzo json` via `server/money.js`, cached 2 min; 503 with the message if sign-in is needed) ·
  `GET /api/money/summary[-fresh]` (repeating payments as monthly costs + `claude -p` once a London day for clean names, groups,
  logo domains and 3–5 insights, kept in data/state/money.json) ·
  `GET /api/burmese` · `POST /api/burmese/{learn,review,save,translate}` (translate = `claude -p --model opus`, ~12 s) · `GET /api/expected` (repeating payments/income predicted from the last 89 days — monthly or weekly, split by amount when a
  payee has several, stopped ones dropped, late ones shown today; next 90 days; Monzo data reused up to 1 h).
  Static: `/data/food/*` from data/food; anything else is the built app (page URLs fall back to index.html).
- **Frontend** (`app/web/src/`), grouped by feature:
  - `app/` — App.tsx (routes), Layout.tsx (dock, quick-add, toasts), Dock.tsx.
  - `features/tasks/` — store.tsx (`useTars()`: all task state + actions; `useQuickAdd()` shared by Dock/Layout; quick-add is draft-based — an empty optimistic row that persists on first edit, no NL parsing), TaskRow.tsx,
    TagManager.tsx (lists + their sub-categories), calendar.tsx (CalendarPanel, folded into Home). `features/home/` —
    Home.tsx (the Schedule tab, incl. the "Life, so far" strip), MainEvent.tsx. `features/apps/` — AppsPage.tsx (the
    filter + the three sections). `features/food/` — data.ts (content + server-backed basket/shop), parts.tsx
    (RecipeTile etc.), FoodSection.tsx, RecipePage.tsx, ListPage.tsx. `features/burmese/` — data.ts, BurmeseSection.tsx.
    `features/inbox/` — data.ts (useInbox), InboxPage.tsx (email → task review). `features/tars/` — TarsPage.tsx.
    `features/money/` — data.ts (useSummary), MoneySection.tsx, expected.tsx (useExpected, Logo,
    PaymentRow — used by Home, calendar and Money). Each app's `*Section.tsx` is bare content (no page header) composed by
    AppsPage; shared bits in `components/common.tsx` — `FilterBar`/`FilterLabel` (the sticky pill), SectionHead, etc.
  - `components/` — Page.tsx (every page's header/back/width), common.tsx (FilterBar, FilterLabel, SectionHead, Section, Empty, PillBar, pill),
    `ui/` (shadcn: `cd app/web && npx shadcn@latest add <name>`). `lib/` — api.ts, dates.ts, utils.ts, use-resource.ts (shared `{data,error,loading,reload}` fetch hook for read-mostly features).
  - **One look everywhere**: shadcn components + the shared pieces above; never hard-code colours — use the tokens in
    `src/index.css` (dark only, blue `primary`, due/priority colours). No second theme or CSS file.
  - **Crispness rules** (see UI-CRISPNESS-BRIEF.md): type ramp only — `text-xs/sm/base/lg/xl/2xl` = 12/13/15/17/20/24,
    `text-field` (16) for every text input so iOS never zooms; weights 400 body / 600 labels / 700 headings.
    4px spacing scale, no half steps, **no arbitrary `[..px]` values** — add a named token/utility in index.css
    instead (e.g. `text-hero`, `rounded-mark`, `max-w-page`, `pt-safe-*`/`pb-safe-*`/`bottom-safe-*`, `top-below-header`, `ease-sheet`).
    Separators are `hairline`/`hairline-t`/`hairline-b` (0.5px). Sticky/fixed bars use solid `chrome-bar`/`bg-chrome`;
    **no backdrop blur except the dock**. No visible scrollbars. Cards: `glass` (translucent, no blur). Motion: transform/opacity only,
    150–250ms (`ease-sheet` for sheets); reduced motion is handled globally.
  - Browser storage is only for view preferences (last list tab, food filters). Anything that should follow Lian between
    devices goes through the server into data/state/.
  - Dev: `npm run dev` in `app/web` (proxies `/api` and `/data` to :8400).
- **Food content** is made on the Mac from the full HelloFresh archive (`~/dev/hellofresh-recipes`): edit its
  my-menu.json, run `python3 export_tars.py` there (writes data/food/ here), commit, push, then `bin/sync` on the PC.
  Recipes/photos are HelloFresh's copyrighted content: personal use only, never publish.
- `bin/sync` — pull, build, restart. `bin/up <dir>` — build (`build` in app.json) and (re)start `tars-<dir>` as a user
  service on the tailnet (`https` field, else its port). `bin/backup` — snapshot data/state to `~/tars-backups/`
  (daily timer via `bin/backup install`, 30 days kept); the Mac pulls that folder daily (launchd `com.tars.backup`).

## Tools
- `bin/gmail` — read-only Gmail for cottrelllian@gmail.com (the only Gmail path — the claude.ai Gmail and Todoist
  connectors are denied in `.claude/settings.json`): `bin/gmail search '<gmail query>' [-n N]`, `bin/gmail read <id>`.
  OAuth client + token live in `~/.config/tars/` (outside the repo — never copy them into it or print them).
  If it says sign-in expired: `bin/gmail login`, give Lian the link, then `bin/gmail login '<localhost address they paste back>'`.
- `bin/monzo` — read-only Monzo (balance, pots, transactions; never moves money): `bin/monzo status|balance`,
  `bin/monzo transactions [-d DAYS]` (max 89 days - older needs re-verification). Client + token in `~/.config/tars/monzo-*.json`
  (never copy into the repo or print). Sign-in: `bin/monzo login`, give Lian the link, `bin/monzo login '<address>'`,
  then Lian approves in the Monzo app. Not yet available to Tars chat (`app/server/ask.js` allowlist).

## Working rules
- Pull before starting work; commit and push when a change is done.
- `~/tars` on `main` is the one live checkout (the running service reads its `data/state/`). Parallel or risky work goes
  in a **git worktree**, not a second edit of `~/tars`: `git -C ~/tars worktree add -b <branch> ~/tars-wt/<branch> main`,
  edit/build/commit there, then merge and `git -C ~/tars worktree remove ~/tars-wt/<branch>`. Worktrees have no
  `data/state/` (it's gitignored and lives only in `~/tars`), so they're for code; the live service always runs from `~/tars`.
- After a change: `bin/up app` (builds the UI and restarts), then give Lian the link to check on their phone.
  `bin/up` reinstalls deps only when `package-lock.json` changed, so repeat deploys are fast.
- Quick check mid-work: `cd app/web && npm run typecheck` (`tsc -b`, no bundle). Before committing UI changes,
  `cd app/web && npm run build` must still pass.
- Try risky changes on a spare port: build `app/web`, run `TARS_DATA=<copy of data/> PORT=9xxx node app/server`, `tailscale serve --bg --https=9xxx http://127.0.0.1:9xxx`, remove after.
- Service: `systemctl --user status|restart tars-app`; logs: `journalctl --user -u tars-app`.
- Don't write explanatory comments in code. After a meaningful change, give a short list of next steps.
