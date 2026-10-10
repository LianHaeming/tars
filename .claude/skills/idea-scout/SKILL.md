---
name: idea-scout
description: Research what people on the internet want and have already built around a feature or app idea, to find ideas for tars. Fans out one scout subagent per source (GitHub, Reddit, Hacker News, products, the web, Lian's vaults), then compiles one ranked Markdown report into the tars Obsidian vault. Use when Lian asks "what ideas are out there for X", "what have people built for X", "scout X", "research ideas for X", or runs /idea-scout <topic>.
---

# idea-scout

You are the orchestrator. Lian names a topic ("financial dashboards from my bank transactions", "language learning",
"meal planning"…); you brief six scouts, one per source, run them in parallel, then turn their reports into one note
in the tars vault: **what people want, what already exists, and what of it tars could do.**

Paths: the skill is `~/tars/.claude/skills/idea-scout` (call it `<skill>` in briefs, written out in full), the scouts'
agent type is `idea-scout`, notes go to `~/tars/vaults/tars/idea-scout/`.

## 1. Frame the topic
- The topic is the skill's argument. If there is none, or it's too vague to search ("money"), ask Lian one question
  to pin it down, then go on.
- Make a kebab-case **slug** (`finance-dashboards`, `language-learning`).
- If `~/tars/vaults/tars/idea-scout/<slug>.md` exists, read it: this is a re-run, and the new note should say what's
  new since then.

## 2. Ground it in tars
Read the tars repo's `CLAUDE.md` (`~/tars/repos/github/LianHaeming/tars/CLAUDE.md`) for the apps and pages that touch the topic.
Write down in a few lines **what tars already has** for it and **what data tars can reach** (Monzo transactions and
balance, Gmail, WhatsApp messages, the tasks list, food recipes and basket, the Burmese/Omarchy memorisation
progress, the Obsidian vaults, GitHub). This keeps the report about tars rather than about the internet in general.

## 3. Quick reconnaissance (yourself, 2–3 searches)
So every scout searches the same space:
- **Known products**: 4–8 commercial apps and 3–6 open-source projects (with `owner/repo`) in the space.
- **Search phrases**: 8–12 ways people would talk about it, including need phrases ("I wish <app> showed…", "how do
  you track…", "what's your setup for…").
- **Communities**: 3–6 subreddits.

## 4. Brief the scouts — all six in ONE message
Spawn six `Agent` calls in a single message, `subagent_type: "idea-scout"`, one per source: `github`, `reddit`,
`hackernews`, `products`, `web`, `vault`. Each prompt is the same brief plus its source:

```
Source: <source>. Playbook: read ~/tars/.claude/skills/idea-scout/scouts/<source>.md first and follow it.
Helper scripts are in ~/tars/.claude/skills/idea-scout/scripts/.

Topic: <topic, one or two sentences on what Lian wants to explore>
tars already has: <from step 2>
Data tars can reach: <from step 2>
Known products: <list, with owner/repo for open source>
Search phrases: <list>
Subreddits: <list>
Today: <YYYY-MM-DD>. Prefer recent material, but keep older posts with strong signal.

Report in the format your agent instructions give.
```

They run in the background; you're told as each finishes. While waiting, don't predict or summarise results you
haven't received. If a scout fails outright, you may re-spawn it once; otherwise carry on and record the gap.

## 5. Compile
Merge the six reports into idea clusters. The point is judgement, not a pile of links:
- **Merge** the same idea across sources: an idea seen in three sources with votes behind it beats a clever one-off.
- **Evidence**: strong (many votes, or it recurs across ≥ 3 sources), medium, weak (a single mention).
- **Fit for tars**: where it would live (which app or page, or a new one), and whether tars already has the data.
  Prefer ideas that use data tars already has.
- **Effort**: S (an afternoon: a tile, a view over existing data), M (a new page or a new data source), L (a new
  app, an external integration, ongoing maintenance).
- **Already decided** (from the vault scout) beats the internet: don't recommend what Lian has rejected; say it was
  rejected if it's popular.
- Keep exact quotes and real links only. Never link to something no scout reported.

## 6. Write the note
`~/tars/vaults/tars/idea-scout/<slug>.md` (it syncs to Lian's phone within seconds). On a re-run, overwrite it,
keeping `created`, and fill in "New since last time". No wikilinks (`[[…]]`): Lian makes those by hand.

```markdown
---
title: "Ideas: <topic>"
type: research
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
topic: <topic>
sources: github, reddit, hackernews, products, web, vault
---

# Ideas: <topic>

<two or three sentences: what was searched, the biggest pattern, the best bet for tars>

## Best bets for tars
<the top 3–7, each:>
### 1. <idea>
<what it is, in plain words, and why people want it — with a quote if there's a good one>
- **Evidence:** strong · <the numbers, e.g. "312 👍 on Actual Budget, top r/ynab thread, 3 of 6 sources">
- **In tars:** <app/page>, using <data> · **Effort:** S
- **Done before by:** <product/project> — <link>

## All ideas
| Idea | Evidence | Where in tars | Effort | Sources |
|---|---|---|---|---|
<every cluster, strongest first; Sources as short links like [GH](…) [Reddit](…)>

## Already out there
<the notable products and projects, one line each, with a link: what they do best>

## What people hate
<pitfalls and complaints to avoid>

## Wild cards
<clever or contrarian ideas worth a thought>

## New since last time
<re-runs only; otherwise leave this section out>

## How this was made
<one line per scout: status and what it covered; name any source that failed or was partial>
```

## 7. Tell Lian
Reply briefly: the note's name (`idea-scout/<slug>.md`), the top 3 ideas in one line each, and any scout that failed.
Offer to put a chosen idea on the tars app's **Idea** list (tasks API, undated); don't add it unasked.
