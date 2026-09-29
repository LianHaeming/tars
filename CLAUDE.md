# tars

Lian's personal assistant app on the Omarchy PC (`~/tars`). Lian starts Claude here and usually drives it with
Remote Control from their phone or iPad, and uses the app on their phone over Tailscale at
**https://omarchy.tail0bf266.ts.net/**. One private repo: github.com/LianHaeming/tars (Mac clone: `~/dev/tars`).

(Separate from robin, Lian's planner/notes toolbox on the Mac.)

## Layout
- `app/` — the tars app. Home screen (D-style: colour wash + glass): Next up card, Food / Shopping buttons,
  then **flat lists at the root** — Upcoming (dated) and Tasks (undated, not Shopping). A glass dock at the bottom has
  **Add task** (quick-add sheet) and **Tars** (Ask Claude chat). Everything else is a **page** with its own URL and a back
  button — Lian doesn't want pop-up windows: `/lists/:key` (All lists), `/month?d=`, `/shopping`, `/tars`, `/food`,
  `/food/:id` (recipe), `/food/list` (dishes → ingredients → "Send to Shopping list"). No bottom tabs (Lian's choice).
  "Todo"/"calendar" always means this app.
  - `server.js` — Node, no dependencies. `/api/*` (state, tasks, projects, shopping, ask), static `dist/` (the built UI;
    any extension-less path falls back to `index.html` for the router), `/food/` → `../food/` (data + photos). Data in `app/data.json` (gitignored, PC only). Port 8400, served on the tailnet at 443.
  - `POST /api/ask {message, sessionId}` runs `claude -p` in `~/tars` (streams NDJSON: text/status/error/done). It may
    read files, use `bin/gmail` and `curl` the API, and is denied Edit/Write — it never changes code.
  - `web/` — the UI: **React + TypeScript + Vite + Tailwind v4 + shadcn/ui** (style radix-nova, lucide icons, Geist font).
    Builds to `app/dist/` (gitignored) — `bin/up app` runs the build (`build` in `app.json`) before restarting.
    - **One look everywhere**: use shadcn components (`cd app/web && npx shadcn@latest add <name>` →
      `src/components/ui/`) and the shared pieces in `components/common.tsx` (SectionHead, Section, Empty, PillBar, pill)
      and `components/Page.tsx` (every page's header/back/width). Never hard-code colours — use the theme tokens in
      `src/index.css` (dark only, blue `primary`, due/priority colours, `glass`/`glass-strong`). No second theme or CSS file.
    - `src/lib/store.tsx` — all state and actions (`useTars()`); `lib/quickadd.ts` — quick-add parsing; `lib/dates.ts`.
    - `src/sections/<name>.tsx` — one file per home section, listed in display order in `sections/index.ts`:
      next-up, actions, upcoming, tasks.
    - `src/App.tsx` — routes (react-router). `src/pages/` — ListsPage (+ ShoppingPage), MonthPage, TarsPage.
      `src/food/` — MenuPage, RecipePage, ListPage, `data.ts` (loads `/food/app/data/*.json`, basket + shop choice in
      localStorage), `parts.tsx`. `src/components/` — TaskRow (row + inline editor), QuickAdd, Dock, NameDialog.
    - Dev: `npm run dev` in `app/web` (proxies `/api` and `/food/app|photos` to :8400).
- `food/` — HelloFresh menu data (Lian's 63 dishes) + photos. `build_app.py` writes JSON to `food/app/data/` (gitignored)
  that the Food pages in `app/web/src/food/` read. "Send to Shopping list" → `POST /api/shopping`, which replaces the
  unticked items of the Shopping list. Recipes/photos are HelloFresh's copyrighted content: personal use only, never publish.
  The full archive is on the Mac (`~/dev/hellofresh-recipes`); to change the menu run `export_menu.py` there
  (see its docstring), commit, push, then `bin/sync` here.
- `bin/sync` — pull, rebuild food, restart the app. `bin/up <dir>` — (re)start a folder with an `app.json` as the
  `tars-<dir>` user service and serve it over tailnet HTTPS (`https` field, else its port).

## Tools
- `bin/gmail` — read-only Gmail for cottrelllian@gmail.com (the only Gmail path — the claude.ai Gmail and Todoist
  connectors are denied in `.claude/settings.json`): `bin/gmail search '<gmail query>' [-n N]`, `bin/gmail read <id>`.
  OAuth client + token live in `~/.config/tars/` (outside the repo — never copy them into it or print them).
  If it says sign-in expired: `bin/gmail login`, give Lian the link, then `bin/gmail login '<localhost address they paste back>'`.

## Working rules
- Pull before starting work; commit and push when a change is done. Only one session edits `~/tars` at a time.
- After a change: `bin/up app` (builds the UI, restarts; or `bin/sync` if food changed), then give Lian the link to check on their phone.
- Before committing UI changes, `cd app/web && npm run build` must pass (it type-checks).
- Try risky changes on a spare port: copy `app/` elsewhere, build `web/`, run it with `PORT=9xxx`, `tailscale serve --bg --https=9xxx http://127.0.0.1:9xxx`, remove after.
- Service: `systemctl --user status|restart tars-app`; logs: `journalctl --user -u tars-app`.
- Don't write explanatory comments in code. After a meaningful change, give a short list of next steps.
