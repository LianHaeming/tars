# tars

Lian's personal assistant app on the Omarchy PC (`~/tars/repos/github/LianHaeming/tars`, inside the `~/tars` workspace — see
`~/tars/CLAUDE.md` for workspace rules). Lian starts Claude in `~/tars` and usually drives it with
Remote Control from their phone or iPad, and uses the app on their phone over Tailscale at
**https://omarchy.tail0bf266.ts.net/**. One private repo: github.com/LianHaeming/tars (Mac clone: `~/dev/tars`).

(Separate from robin, Lian's planner/notes toolbox on the Mac.)

## Layout
A small monorepo of **standalone apps**. Each app has its own server, React frontend, systemd service, Tailscale HTTPS
port, home-screen icon and state. The apps share code through two workspace packages, and they share data only through
each other's APIs.

```
apps/<app>/
  app.json       service config for bin/up: {name, port, https, start, build}
  server/        Node, no dependencies beyond @tars/server: index.js (routes), state.js (this app's JSON docs), …
  web/           React + TypeScript + Vite + Tailwind v4 + shadcn/ui — display only, everything via its own /api
  state/         live data (gitignored): a symlink to ~/tars/apps/<app>/state on the live checkout, empty in a worktree
  dist/          the built web app (gitignored)
packages/
  ui/            @tars/ui — the one look: styles/globals.css (tokens), components/ui (shadcn), Page, AppShell, common,
                 lib/{api,apps,dates,utils,use-resource}, hooks
  server/        @tars/server — docs() (JSON state), start() (HTTP + static + /sw.js tombstone), runClaude
data/food/       Food content: menu.json, r/<id>.json, sainsburys/ocado.json, photos/ (in git; published from the Mac)
bin/             up, sync, icon, gmail, monzo, burmese, email-tasks, whatsapp (+ lib/state.sh)
```

| App | Internal port | URL (tailnet) | Owns |
|---|---|---|---|
| tasks (`tars-tasks`) | 8400 | https://omarchy.tail0bf266.ts.net/ | tasks (incl. the Shopping list), inbox |
| burmese (`tars-burmese`) | 8404 | https://omarchy.tail0bf266.ts.net:8444/ | burmese |
| discover (`tars-discover`) | 8405 | https://omarchy.tail0bf266.ts.net:8445/ | discover |
| whatsapp (`tars-whatsapp`) | 8406 | https://omarchy.tail0bf266.ts.net:8446/ | whatsapp (written by the bridge, `tars-whatsapp-bridge`; the viewer only reads) |
| money (`tars-money`) | 8407 | https://omarchy.tail0bf266.ts.net:8447/ | money |
| food (`tars-food`) | 8408 | https://omarchy.tail0bf266.ts.net:8448/ | food (+ serves data/food) |

There is no launcher: the iPhone Home Screen is the launcher (one icon per app). A new app takes the next port pair
(internal 840x, public 844x).

**How the apps share data** (all server to server via `callApp(app, method, path, body)` from @tars/server, which
reads the owner's port from its app.json; `TARS_PORT_<APP>` overrides it for side-by-side tests on spare ports):
- tasks `GET /api/expected` → money `GET /api/expected` (the teal payment rows on the Schedule and calendar; if money
  is down the Schedule just loads without them).
- food `POST /api/shopping` → tasks `POST /api/shopping` (tasks owns the Shopping list; it answers `{projectId}` and
  the food toast's Open goes to `appUrl('tasks', '/?filter=<projectId>')`).
- bin/email-tasks → tasks `/api/inbox` (as before, on :8400).

**Rules of the split** (they keep it robust):
- **One owner per data file.** `docs()` keeps each JSON file in memory and rewrites it whole, so two processes writing
  the same file silently lose each other's changes. Another app changes it by calling the owner's API **server to server
  on 127.0.0.1** — a page only ever calls its own origin's `/api` (no CORS, nothing new exposed).
- **Separate origins, not paths.** Every app sits at `/` on its own port, so service workers, storage, manifests and
  home-screen identities can never collide. Link between apps with `appUrl('<app>')` from `@tars/ui/lib/apps` (the one
  registry of public ports). iOS opens a link to another app in a Safari sheet over the current one.
- **Shared code lives in packages/, never copied.** If two apps need it, it moves to @tars/ui or @tars/server.
- A new app: copy apps/burmese as the template, pick the next ports, `bin/icon <app> <glyph> [font]`, add it to
  `APP_PORTS`, then `bin/up <app>` on the live checkout and add it to the Home Screen from Safari.

- **The tasks app** (`apps/tasks`, the original "t" icon at /): **Schedule** (`/`) — a flat **"Life, so far"** strip,
  then a sticky row of monochrome list filter labels (All + one per list with a small colour-matched tag icon, + Completed;
  choice kept in browser storage; `?filter=<listId>` picks one; on scroll the strip slides up behind the Dynamic Island —
  shaded by a global top gradient scrim (`.island-scrim` in globals.css, rendered by AppShell, z-10: fades content under
  the status bar, sits below the sticky filter/headers) — while the filters lock to the top), the **Email** review card
  (when bin/email-tasks has queued candidates; opens `/inbox`), the Sort card, **Upcoming** grouped by day (next 14 days
  only, then an "N more · See Month" link; Overdue first; expected Monzo payments mixed in as teal Money rows with a
  Money filter label — tapping one opens the Money app; today's next timed task is a highlighted "main event" pill that
  expands in place for notes / Mark done / Edit), then **To-do · no date**. Rows show the list as a coloured tag under
  All. Dock (Schedule only): **Sort** on the left when there are loose to-dos, one-tap **Add task** in the centre; the
  undo flash borrows the centre slot. Safari's status strip is `theme-color` = `--chrome` (#15263a) — keep them equal in
  every app so the top reads as one navy surface; added to the Home Screen each app runs standalone (manifest) under the
  Dynamic Island. Everything else is a **page** with its own URL and a back button — Lian doesn't want pop-up windows:
  `/inbox` (back to `/`). `/month` and `/apps` redirect to `/`; the old `/burmese`, `/discover`, `/whatsapp/*`,
  `/money`, `/food/*` URLs open the new apps. "Todo"/"calendar" = this app.
- **Money app** (`apps/money`, "£"): one root page — a small dashboard, not a Monzo copy: balance line, "goes out
  automatically every month" total split by group, Claude's "Tars noticed" insights, the repeating payments by group with
  logos, next 30 days. API: `GET /api/money[/fresh]` (runs `bin/monzo json` via `server/money.js`, cached 2 min; 503 with
  the message if sign-in is needed) · `GET /api/money/summary[-fresh]` (repeating payments as monthly costs + `claude -p`
  once a London day for clean names, groups, logo domains and 3–5 insights, kept in state/money.json) ·
  `GET /api/expected` (repeating payments/income predicted from the last 89 days — monthly or weekly, split by amount
  when a payee has several, stopped ones dropped, late ones shown today; next 90 days; Monzo data reused up to 1 h).
- **Food app** (`apps/food`, "f"): `/` menu search + recipe carousels (a basket-icon header action opens `/list`, the
  shopping list), `/recipe/:id` (continuous servings slider with "use whole packs" shortcuts and per-ingredient spare;
  "I don't like X" swaps). Both back to `/`. API: `GET|PATCH /api/food {basket, shop, servings}` (servings per recipe
  id, base 2) · `POST /api/food/suggest` · `POST /api/shopping {items}` (passed to tasks). Static: `/data/food/*` from
  the repo's data/food.
- **Burmese app** (`apps/burmese`, its own icon): one root page (no back button) with tabs: Practice, a 100-sentence
  deck in both directions with spaced repetition — 3 new a day, phonetic first; learned list with unlearn, extra practice
  rounds; Phrase of the day — the original phrase bank (server/phrases.js); Translate — quick English → Burmese that can
  add a sentence to the deck. API: `GET /api/burmese` · `POST /api/burmese/{learn,review,unlearn,save,translate}` ·
  `GET /api/burmese/phrases` · `POST /api/burmese/phrase` · `DELETE /api/burmese/history` (translate = `claude -p --model opus`, ~12 s).
  The tasks app's `/burmese` redirects there.
- **Discover app** (`apps/discover`): one root page — a daily "cool GitHub repos" feed: real repos from the GitHub search
  API, curated by `claude -p` once a London day into state/discover.json. API: `GET /api/discover[/fresh]`.
- **WhatsApp app** (`apps/whatsapp`): the conversation list (`/`) and one chat's thread (`/chat/:id`, back to `/`).
  API: `GET /api/whatsapp` (newest first, each with a last-message preview) · `GET /api/whatsapp/:id` — read-only;
  `server/whatsapp.js` re-reads state/whatsapp.json when its mtime changes. The file is written by the capture bridge
  in `apps/whatsapp/bridge` (its own package.json, outside the workspaces, and its own service `tars-whatsapp-bridge`).
- **Tasks API** (`apps/tasks/server/index.js`): `GET /api/state` · `POST|PATCH|DELETE /api/tasks[/id]` · `/api/projects[/id]` (a project PATCH with `subs` sets its sub-categories; tasks carry an optional `subId`) ·
  `POST /api/shopping {items}` (replaces the Shopping list's unticked items; called by food) · `GET /api/expected` (from money) ·
  `GET /api/organise` · `GET|POST /api/inbox`, `POST /api/inbox/:id/accept`, `DELETE /api/inbox/:id`.
  Anything else is the built app (page URLs fall back to index.html).
- **Tasks frontend** (`apps/tasks/web/src/`), grouped by feature:
  - `app/` — App.tsx (routes), Layout.tsx (AppShell + dock, quick-add), Dock.tsx. `lib/types.ts` — Task, Project, State, Candidate.
  - `features/tasks/` — store.tsx (`useTars()`: all task state + actions; `useQuickAdd()` shared by Dock/Layout; quick-add is draft-based — an empty optimistic row that persists on first edit, no NL parsing), TaskRow.tsx,
    TagManager.tsx (lists + their sub-categories), calendar.tsx (CalendarPanel, folded into Home). `features/home/` —
    Home.tsx (the Schedule tab, incl. the "Life, so far" strip), MainEvent.tsx, OrganiseCard.tsx + organise.tsx (Sort).
    `features/inbox/` — data.ts (useInbox), EmailCard.tsx (on the Schedule), InboxPage.tsx (email → task review).
- **Other apps' frontends** are `apps/<app>/web/src/app/App.tsx` (router: `AppShell` + routes) and
  `features/<app>/` — each app's `*Section.tsx` is bare content (no page header), wrapped by its `*Page.tsx` in `Page`.
- **Shared UI** (`packages/ui/src/`, imported as `@tars/ui/...`; an app's own code stays `@/...`):
  - `components/` — Page.tsx (every page's header/back/width; `back={false}` for an app's root page), AppShell.tsx
    (island scrim, Suspense fallback, toaster, scroll restoration — every app's router root), common.tsx (FilterBar,
    FilterLabel, SectionHead, Section, Empty, Dot), `ui/` (shadcn: `cd apps/<any>/web && npx shadcn@latest add <name>` —
    it writes into packages/ui). `lib/` — api.ts (`api()`, localGet/localSet), apps.ts (`APP_PORTS`, `appUrl`), dates.ts,
    utils.ts, money.ts (`fmt`, `fmt0`), use-resource.ts (shared `{data,error,loading,reload}` fetch hook for read-mostly
    features); `components/payments.tsx` (Expected, useExpected, Logo, PaymentRow — used by tasks and money). `styles/globals.css` — the tokens.
  - **One look everywhere**: shadcn components + the shared pieces above; never hard-code colours — use the tokens in
    `packages/ui/src/styles/globals.css` (dark only, blue `primary`, due/priority colours). No second theme or CSS file.
  - **shadcn, in-grain** (the house rule — follow it religiously): every interactive control is a shadcn/Radix
    primitive (`Button`, `Checkbox`, `Badge`, `Avatar`, `ToggleGroup`, `Collapsible`, `Dialog`, …), added via
    `npx shadcn@latest add <name>` — don't hand-roll a `<button>`/`<input>` when a primitive exists. **Appearance that
    repeats across files becomes a token (`globals.css`) or a `cva` variant in the `ui/` file** (e.g. button `inline`
    size, badge `tag` variant) — never copy-pasted class strings at call sites. Call-site `className` is only for
    **layout/positioning** (margins, width, grid placement), **per-instance data** (a list's colour via `style`), or a
    **contextual reset** (e.g. `normal-case` on a link inside an uppercase header). A one-off shape used in a single
    component stays local (a wrapper component or a file-level `const`); don't promote it to a global variant.
  - **Crispness rules** (see UI-CRISPNESS-BRIEF.md): type ramp only — `text-xs/sm/base/lg/xl/2xl` = 12/13/15/17/20/24,
    `text-field` (16) for every text input so iOS never zooms; weights 400 body / 600 labels / 700 headings.
    4px spacing scale, no half steps, **no arbitrary `[..px]` values** — add a named token/utility in globals.css
    instead (e.g. `text-hero`, `rounded-mark`, `max-w-page`, `pt-safe-*`/`pb-safe-*`/`bottom-safe-*`, `top-below-header`, `ease-sheet`).
    Separators are `hairline`/`hairline-t`/`hairline-b` (0.5px). Sticky/fixed bars use solid `chrome-bar`/`bg-chrome`;
    **no backdrop blur except the dock**. No visible scrollbars. Cards: `glass` (translucent, no blur). Motion: transform/opacity only,
    150–250ms (`ease-sheet` for sheets); reduced motion is handled globally.
  - Browser storage is only for view preferences (last list tab, food filters). Anything that should follow Lian between
    devices goes through the app's server into its state/.
  - Dev: `npm run dev` in `apps/<app>/web` (proxies `/api` to that app's port).
- **Food content** is made on the Mac from the full HelloFresh archive (`~/dev/hellofresh-recipes`): edit its
  my-menu.json, run `python3 export_tars.py` there (writes data/food/ here), commit, push, then `bin/sync` on the PC.
  Recipes/photos are HelloFresh's copyrighted content: personal use only, never publish.
- `bin/sync [app…]` — pull, then `bin/up` every app (or the ones named). `bin/up <app>` — `npm ci` at the root when the
  lockfile changed, link `apps/<app>/state`, build (`build` in app.json) and (re)start `tars-<app>` as a user service on
  the tailnet (`https` field, else its port). Refuses to run from a worktree. State has no backups (Lian's call).
- `bin/icon <app> <glyph> [font]` — the app's home-screen icons (navy gradient + one white glyph, same family for all).

## Tools
- `bin/gmail` — read-only Gmail for cottrelllian@gmail.com (the only Gmail path — the claude.ai Gmail and Todoist
  connectors are denied in `.claude/settings.json`): `bin/gmail search '<gmail query>' [-n N]`, `bin/gmail read <id>`.
  OAuth client + token live in `~/.config/tars/` (outside the repo — never copy them into it or print them).
  If it says sign-in expired: `bin/gmail login`, give Lian the link, then `bin/gmail login '<localhost address they paste back>'`.
- `bin/monzo` — read-only Monzo (balance, pots, transactions; never moves money): `bin/monzo status|balance`,
  `bin/monzo transactions [-d DAYS]` (max 89 days - older needs re-verification). Client + token in `~/.config/tars/monzo-*.json`
  (never copy into the repo or print). Sign-in: `bin/monzo login`, give Lian the link, `bin/monzo login '<address>'`,
  then Lian approves in the Monzo app.

- `bin/whatsapp` — **read-only** WhatsApp capture (reads your messages into apps/whatsapp/state/whatsapp.json; never sends). It links
  the PC as a WhatsApp multi-device companion via **Baileys** (protocol over a WebSocket — no browser); the session lives in
  `~/.config/tars/whatsapp` (Baileys multi-file auth, outside the repo). `bin/whatsapp login` (scan the QR on your phone,
  once — stops the service while you do), `bin/whatsapp install` (runs the bridge as the `tars-whatsapp-bridge` user service),
  `bin/whatsapp status`. History is whatever WhatsApp's on-link sync sends plus everything from link-time onward. Only one
  process can hold the session at a time. No send path by design. (whatsapp-web.js was tried first but is currently broken
  against live WhatsApp Web — its injected accessors throw against the 2.3000.1044+ builds.)

## Working rules
- Pull before starting work; commit and push when a change is done.
- This checkout on `main` is the one live checkout: the services run from it, and each `apps/<app>/state` is a symlink
  to `~/tars/apps/<app>/state` (the live data, outside git). Parallel or risky work goes in a **git worktree** (see
  `~/tars/CLAUDE.md`); a worktree has no symlinks, so its servers get their own empty `state/` — never point them at the live data.
- One `npm install` at the repo root covers every app (npm workspaces, one root package-lock.json).
- After a change: `bin/up <app>` for each app it touches (a change in packages/ touches every app), then give Lian the
  link(s) to check on their phone.
- Quick check mid-work: `cd apps/<app>/web && npm run typecheck` (`tsc -b`, no bundle) — it checks the @tars/ui code it
  uses too. Before committing UI changes, `npm run build` must pass in every affected app.
- Try risky changes on a spare port: build the app's web, run `TARS_STATE=<copy of its state> PORT=9xxx node apps/<app>/server`,
  `tailscale serve --bg --https=9xxx http://127.0.0.1:9xxx`, remove after.
- Services: `systemctl --user status|restart tars-<app>`; logs: `journalctl --user -u tars-<app>`.
- Don't write explanatory comments in code. After a meaningful change, give a short list of next steps.
