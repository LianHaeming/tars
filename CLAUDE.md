# tars

Lian's personal assistant app on the Omarchy PC (`~/tars`). Lian starts Claude here and usually drives it with
Remote Control from their phone or iPad, and uses the app on their phone over Tailscale at
**https://omarchy.tail0bf266.ts.net/**. One private repo: github.com/LianHaeming/tars (Mac clone: `~/dev/tars`).

(Separate from robin, Lian's planner/notes toolbox on the Mac.)

## Layout
- `app/` — the tars app: one dashboard of Whoop-style cards; tapping a card opens it full-screen.
  - `server.js` — Node, no dependencies. `/api/*` (tasks, lists, shopping), static `public/`, and `/food/` → `../food/`.
    Data in `app/data.json` (gitignored, PC only). Port 8400, served on the tailnet at 443.
  - `public/core.js` — tasks logic (state, quick-add parsing, task list/editor, calendar). `public/app.js` — dashboard + panel.
  - `public/cards/<card>.js` — one file per card: `CARDS.push({ id, label, wide?, summary(), open() })`.
    New card = new file + a `<script>` line in `index.html`. Cards: next-up, upcoming, food, tasks.
  - No bottom tabs yet (Lian is still deciding). "Todo"/"calendar" always means this app.
- `food/` — HelloFresh menu (Lian's 63 dishes). `build_app.py` writes `food/app/` (gitignored), shown inside the Food card.
  Its shopping list has "Send to Shopping list" → `POST /api/shopping`, which replaces the unticked items of the
  Shopping list. Recipes/photos are HelloFresh's copyrighted content: personal use only, never publish.
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
- After a change: `bin/up app` (or `bin/sync` if food changed), then give Lian the link to check on their phone.
- Try risky changes on a spare port: copy `app/` elsewhere, run it with `PORT=9xxx`, `tailscale serve --bg --https=9xxx http://127.0.0.1:9xxx`, remove after.
- Service: `systemctl --user status|restart tars-app`; logs: `journalctl --user -u tars-app`.
- Don't write explanatory comments in code. After a meaningful change, give a short list of next steps.
