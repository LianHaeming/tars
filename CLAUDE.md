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
  state/         live data (PC only, gitignored): tasks.json (lists + tasks), food.json (basket, shop), chat.json (Tars)
app/
  server/        Node, no dependencies: index.js (routes + static), store.js (data/state docs), ask.js (Tars chat)
  web/           React + TypeScript + Vite + Tailwind v4 + shadcn/ui — display only, everything via /api
  app.json       service config for bin/up (build → app/dist/, start → node server)
bin/             sync, up, backup, gmail
```

- **The app** (Lian's phone, over Tailscale): Home — Next up card, Food / Shopping buttons, then flat lists at the root:
  Upcoming (dated) and Tasks (undated, not Shopping). Glass dock: **Add task** (quick-add sheet) and **Tars** (chat).
  Everything else is a **page** with its own URL and a back button — Lian doesn't want pop-up windows: `/lists/:key`,
  `/month?d=`, `/shopping`, `/tars`, `/food`, `/food/:id`, `/food/list`. No bottom tabs. "Todo"/"calendar" = this app.
- **API** (`app/server/index.js`): `GET /api/state` · `POST|PATCH|DELETE /api/tasks[/id]` · `/api/projects[/id]` ·
  `POST /api/shopping {items}` (replaces the Shopping list's unticked items) · `GET|PATCH /api/food {basket, shop}` ·
  `GET|DELETE /api/chat` · `POST /api/ask {message}` (runs `claude -p` in `~/tars`, streams NDJSON text/status/error/done,
  saves the conversation in chat.json; read-only tools + `bin/gmail` + curl to the API, never edits code).
  Static: `/data/food/*` from data/food; anything else is the built app (page URLs fall back to index.html).
- **Frontend** (`app/web/src/`), grouped by feature:
  - `app/` — App.tsx (routes), Layout.tsx (dock, quick-add, toasts), Dock.tsx.
  - `features/tasks/` — store.tsx (`useTars()`: all task state + actions), parse-quick-add.ts, TaskRow, QuickAdd,
    NameDialog, ListsPage (+ ShoppingPage), MonthPage. `features/home/` — Home + `sections/` (display order in
    `sections/index.ts`: next-up, actions, upcoming, tasks). `features/food/` — data.ts (content + server-backed basket/shop),
    parts.tsx, MenuPage, RecipePage, ListPage. `features/tars/` — TarsPage.
  - `components/` — Page.tsx (every page's header/back/width), common.tsx (SectionHead, Section, Empty, PillBar, pill),
    `ui/` (shadcn: `cd app/web && npx shadcn@latest add <name>`). `lib/` — api.ts, dates.ts, utils.ts.
  - **One look everywhere**: shadcn components + the shared pieces above; never hard-code colours — use the tokens in
    `src/index.css` (dark only, blue `primary`, due/priority colours). No second theme or CSS file.
  - **Crispness rules** (see UI-CRISPNESS-BRIEF.md): type ramp only — `text-xs/sm/base/lg/xl/2xl` = 12/13/15/17/20/24,
    `text-field` (16) for every text input so iOS never zooms; weights 400 body / 600 labels / 700 headings.
    4px spacing scale, no half steps, **no arbitrary `[..px]` values** — add a named token/utility in index.css
    instead (e.g. `max-w-page`, `pt-safe-*`/`pb-safe-*`/`bottom-safe-*`, `top-below-header`, `ease-sheet`).
    Separators are `hairline`/`hairline-t`/`hairline-b` (0.5px). Sticky/fixed bars use solid `chrome-bar`/`bg-chrome`;
    **no backdrop blur except the dock**. Cards: `glass` (translucent, no blur). Motion: transform/opacity only,
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

## Working rules
- Pull before starting work; commit and push when a change is done. Only one session edits `~/tars` at a time.
- After a change: `bin/up app` (builds the UI and restarts), then give Lian the link to check on their phone.
- Before committing UI changes, `cd app/web && npm run build` must pass (it type-checks).
- Try risky changes on a spare port: build `app/web`, run `TARS_DATA=<copy of data/> PORT=9xxx node app/server`, `tailscale serve --bg --https=9xxx http://127.0.0.1:9xxx`, remove after.
- Service: `systemctl --user status|restart tars-app`; logs: `journalctl --user -u tars-app`.
- Don't write explanatory comments in code. After a meaningful change, give a short list of next steps.
