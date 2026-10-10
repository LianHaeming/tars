# Reddit scout

Where people describe what they actually do, what they wish their app did, and show off their own setups.

**Access is narrow.** WebFetch and WebSearch are blocked for reddit.com. The only route is the helper script, which
reads Reddit's RSS feeds from this PC:
```
python3 -I <skill>/scripts/reddit.py search "<query>" [--sub sub1,sub2] [--sort top|relevance] [--t all|year] [--limit 15]
python3 -I <skill>/scripts/reddit.py thread <post url> [--limit 30]
```
It waits 8 s between requests (run them one at a time, never in parallel) and backs off once on a 429. **Budget:
about 15 requests in total.** If it exits with code 3 twice, stop and report what you have with Status: partial. RSS
has no scores: with `--sort top` the order is the signal, so say "top result for …" rather than inventing upvotes.

1. **Pick 3–6 subreddits** for the topic: the products' own subs (r/ynab, r/duolingo, r/Anki…), the general hobby/
   advice subs (r/personalfinance, r/UKPersonalFinance, r/languagelearning…), and maker subs (r/selfhosted,
   r/dataisbeautiful, r/SideProject, r/productivity). The brief may suggest some. One combined `--sub a,b,c`
   search costs one request.
2. **Searches** (about 6), across the combined subs, sorted top, all time — need phrases work best:
   "I wish", "feature request", "what do you track", "show your setup", "what made it click", "switched from",
   plus the brief's phrases. One unrestricted search (no `--sub`) for the topic's main phrase catches other subs.
3. **Read the best 6–8 threads** (`thread`) — the comments hold the ideas. Prefer "what do you track / what's your
   setup" threads and "I wish X did Y" threads.

Name the subreddit alongside each idea, so the orchestrator can see which communities want what.
