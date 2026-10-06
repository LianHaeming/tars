# tars

Lian's personal assistant app on the Omarchy PC (`~/tars/repos/github/LianHaeming/tars`, inside the `~/tars` workspace — see
`~/tars/CLAUDE.md` for workspace rules). Lian starts Claude in `~/tars` and usually drives it with
Remote Control from their phone or iPad, and uses the app on their phone over Tailscale at
**https://omarchy.tail0bf266.ts.net/**. One private repo: github.com/LianHaeming/tars (Mac clone: `~/dev/tars`).

(Separate from robin, Lian's planner/notes toolbox on the Mac.)

## Layout
One data folder, one server, one React frontend.

```
data/            all data — only the server reads or writes it
  food/          Food content: menu.json, r/<id>.json, sainsburys/ocado.json, photos/ (in git; published from the Mac)
  state/         live data (PC only, gitignored; a symlink to ~/tars/apps/tars/state): tasks.json (lists + tasks), food.json (basket, shop, servings), money.json (AI labels + insights), whatsapp.json (captured messages — private, never backed up)
app/
  server/        Node, no dependencies: index.js (routes + static), store.js (data/state docs), money.js (Monzo), claude.js (shared `claude` CLI runner for burmese/money), burmese.js (deck, progress, translator), whatsapp.js (read-only view over whatsapp.json)
  whatsapp/      isolated WhatsApp capture bridge — its OWN package.json (Baileys, no browser), kept out of the no-dependency server; writes data/state/whatsapp.json, never sends
  web/           React + TypeScript + Vite + Tailwind v4 + shadcn/ui — display only, everything via /api
  app.json       service config for bin/up (build → app/dist/, start → node server)
bin/             sync, up, backup, gmail, monzo, burmese (rebuilds the deck — stop the service first), email-tasks, whatsapp
```

- **The app** (Lian's phone, over Tailscale): two tabs. **Schedule** (`/`) — a flat **"Life, so far"** strip, then a
  sticky row of monochrome list filter labels (All + one per list with a small colour-matched tag icon, + Completed; choice kept in browser
  storage; on scroll the strip slides up behind the Dynamic Island — shaded by a global top gradient scrim
  (`.island-scrim` in index.css, z-10: fades content under the status bar, sits below the sticky filter/headers) —
  while the filters lock to the top), **Upcoming**
  grouped by day (next 14 days only, then an "N more · See Month" link; Overdue first; expected Monzo payments mixed in
  as teal Money rows with a Money filter label; today's next timed task is a highlighted "main event" pill that expands
  in place for notes / Mark done / Edit), then **To-do · no date**. Rows show the list as a coloured tag under All.
  **Apps** (`/apps`) — a **launcher**: the Email review card atop (when there are candidates), then a tappable tile per
  app leading into its own page. Each app is its own full `Page` (header + back to `/apps`): **Food** (`/food` — menu
  search + recipe carousels; a basket-icon header action opens the shopping list; recipes have a continuous servings
  slider with "use whole packs" shortcuts and per-ingredient spare), **Burmese** (`/burmese` — tabs: Practice, a
  100-sentence deck in both directions with spaced repetition — 3 new a day, phonetic first; learned list with unlearn,
  extra practice rounds; Phrase of the day — the original phrase bank (server/phrases.js); Translate — quick English →
  Burmese that can add a sentence to the deck) and **Money** (`/money` — a small dashboard, not a Monzo copy: balance
  line, "goes out automatically every month" total split by group, Claude's "Tars noticed" insights, the repeating
  payments by group with logos, next 30 days). Each app's `*Section.tsx` is still bare content; a thin `*Page.tsx`
  wraps it in `Page`. Dock (on Schedule, Apps and app pages): a **page-specific primary action in the centre** (Schedule
  = one-tap **Add task**; other apps none yet — `Dock.tsx` chooses it by path) and a single context **nav button on the
  right** that flips by path (on Schedule it opens Apps; anywhere else it returns to Schedule); the undo flash borrows
  the centre slot. Safari's status strip
  is `theme-color` = `--chrome` (#15263a) — keep them equal so the top reads as one navy surface; added to the Home
  Screen it runs standalone (manifest) under the Dynamic Island. Everything else is a **page** with its own URL and a
  back button — Lian doesn't want pop-up windows: `/inbox`, `/food/:id`, `/food/list` (these two back to
  `/food`). `/month` redirects to `/`. "Todo"/"calendar" = this app.
- **API** (`app/server/index.js`): `GET /api/state` · `POST|PATCH|DELETE /api/tasks[/id]` · `/api/projects[/id]` (a project PATCH with `subs` sets its sub-categories; tasks carry an optional `subId`) ·
  `POST /api/shopping {items}` (replaces the Shopping list's unticked items) · `GET|PATCH /api/food {basket, shop, servings}` (servings per recipe id, base 2) ·
  `GET /api/money[/fresh]` (runs `bin/monzo json` via `server/money.js`, cached 2 min; 503 with the message if sign-in is needed) ·
  `GET /api/money/summary[-fresh]` (repeating payments as monthly costs + `claude -p` once a London day for clean names, groups,
  logo domains and 3–5 insights, kept in data/state/money.json) ·
  `GET /api/burmese` · `POST /api/burmese/{learn,review,unlearn,save,translate}` · `GET /api/burmese/phrases` · `POST /api/burmese/phrase` (translate = `claude -p --model opus`, ~12 s) · `GET /api/expected` (repeating payments/income predicted from the last 89 days — monthly or weekly, split by amount when a
  payee has several, stopped ones dropped, late ones shown today; next 90 days; Monzo data reused up to 1 h).
  `GET /api/whatsapp` (conversation list, newest first, each with a last-message preview) · `GET /api/whatsapp/:id` (one chat's full thread) —
  read-only; `app/server/whatsapp.js` re-reads data/state/whatsapp.json (written by the separate `tars-whatsapp` bridge) when its mtime changes.
  Static: `/data/food/*` from data/food; anything else is the built app (page URLs fall back to index.html).
- **Frontend** (`app/web/src/`), grouped by feature:
  - `app/` — App.tsx (routes), Layout.tsx (dock, quick-add, toasts), Dock.tsx.
  - `features/tasks/` — store.tsx (`useTars()`: all task state + actions; `useQuickAdd()` shared by Dock/Layout; quick-add is draft-based — an empty optimistic row that persists on first edit, no NL parsing), TaskRow.tsx,
    TagManager.tsx (lists + their sub-categories), calendar.tsx (CalendarPanel, folded into Home). `features/home/` —
    Home.tsx (the Schedule tab, incl. the "Life, so far" strip), MainEvent.tsx. `features/apps/` — AppsPage.tsx (the
    launcher: Email card + one tile per app). `features/food/` — data.ts (content + server-backed basket/shop), parts.tsx
    (RecipeTile etc.), FoodSection.tsx, FoodPage.tsx, RecipePage.tsx, ListPage.tsx. `features/burmese/` — data.ts, BurmeseSection.tsx, BurmesePage.tsx.
    `features/inbox/` — data.ts (useInbox), InboxPage.tsx (email → task review).
    `features/money/` — data.ts (useSummary), MoneySection.tsx, MoneyPage.tsx, expected.tsx (useExpected, Logo,
    PaymentRow — used by Home, calendar and Money). Each app's `*Section.tsx` is bare content (no page header), wrapped by
    its `*Page.tsx` in `Page`; the Schedule tab still uses `FilterBar`/`FilterLabel` (the sticky filter rail) from
    `components/common.tsx`, alongside SectionHead, etc.
  - `components/` — Page.tsx (every page's header/back/width), common.tsx (FilterBar, FilterLabel, SectionHead, Section, Empty, Dot),
    `ui/` (shadcn: `cd app/web && npx shadcn@latest add <name>`). `lib/` — api.ts, dates.ts, utils.ts, use-resource.ts (shared `{data,error,loading,reload}` fetch hook for read-mostly features).
  - **One look everywhere**: shadcn components + the shared pieces above; never hard-code colours — use the tokens in
    `src/index.css` (dark only, blue `primary`, due/priority colours). No second theme or CSS file.
  - **shadcn, in-grain** (the house rule — follow it religiously): every interactive control is a shadcn/Radix
    primitive (`Button`, `Checkbox`, `Badge`, `Avatar`, `ToggleGroup`, `Collapsible`, `Dialog`, …), added via
    `npx shadcn@latest add <name>` — don't hand-roll a `<button>`/`<input>` when a primitive exists. **Appearance that
    repeats across files becomes a token (`index.css`) or a `cva` variant in the `ui/` file** (e.g. button `inline`
    size, badge `tag` variant) — never copy-pasted class strings at call sites. Call-site `className` is only for
    **layout/positioning** (margins, width, grid placement), **per-instance data** (a list's colour via `style`), or a
    **contextual reset** (e.g. `normal-case` on a link inside an uppercase header). A one-off shape used in a single
    component stays local (a wrapper component or a file-level `const`); don't promote it to a global variant.
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
  service on the tailnet (`https` field, else its port). data/state has no backups (Lian's call).

## Tools
- `bin/gmail` — read-only Gmail for cottrelllian@gmail.com (the only Gmail path — the claude.ai Gmail and Todoist
  connectors are denied in `.claude/settings.json`): `bin/gmail search '<gmail query>' [-n N]`, `bin/gmail read <id>`.
  OAuth client + token live in `~/.config/tars/` (outside the repo — never copy them into it or print them).
  If it says sign-in expired: `bin/gmail login`, give Lian the link, then `bin/gmail login '<localhost address they paste back>'`.
- `bin/monzo` — read-only Monzo (balance, pots, transactions; never moves money): `bin/monzo status|balance`,
  `bin/monzo transactions [-d DAYS]` (max 89 days - older needs re-verification). Client + token in `~/.config/tars/monzo-*.json`
  (never copy into the repo or print). Sign-in: `bin/monzo login`, give Lian the link, `bin/monzo login '<address>'`,
  then Lian approves in the Monzo app.

- `bin/whatsapp` — **read-only** WhatsApp capture (reads your messages into data/state/whatsapp.json; never sends). It links
  the PC as a WhatsApp multi-device companion via **Baileys** (protocol over a WebSocket — no browser); the session lives in
  `~/.config/tars/whatsapp` (Baileys multi-file auth, outside the repo). `bin/whatsapp login` (scan the QR on your phone,
  once — stops the service while you do), `bin/whatsapp install` (runs the bridge as the `tars-whatsapp` user service),
  `bin/whatsapp status`. History is whatever WhatsApp's on-link sync sends plus everything from link-time onward. Only one
  process can hold the session at a time. No send path by design. (whatsapp-web.js was tried first but is currently broken
  against live WhatsApp Web — its injected accessors throw against the 2.3000.1044+ builds.)

## Working rules
- Pull before starting work; commit and push when a change is done.
- This checkout on `main` is the one live checkout: the services run from it, and its `data/state` is a symlink to
  `~/tars/apps/tars/state` (the live data, outside git). Parallel or risky work goes in a **git worktree** (see
  `~/tars/CLAUDE.md`); a worktree has no symlink, so its server gets its own empty `data/state` — never point it at the live data.
- After a change: `bin/up app` (builds the UI and restarts), then give Lian the link to check on their phone.
  `bin/up` reinstalls deps only when `package-lock.json` changed, so repeat deploys are fast.
- Quick check mid-work: `cd app/web && npm run typecheck` (`tsc -b`, no bundle). Before committing UI changes,
  `cd app/web && npm run build` must still pass.
- Try risky changes on a spare port: build `app/web`, run `TARS_DATA=<copy of data/> PORT=9xxx node app/server`, `tailscale serve --bg --https=9xxx http://127.0.0.1:9xxx`, remove after.
- Service: `systemctl --user status|restart tars-app`; logs: `journalctl --user -u tars-app`.
- Don't write explanatory comments in code. After a meaningful change, give a short list of next steps.
