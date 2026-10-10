# Hacker News scout

Makers showing what they built (Show HN), people describing their own systems (Ask HN), and long, opinionated comment
threads. Free Algolia API through the helper:
```
python3 -I <skill>/scripts/hn.py search "<query>" [--tags story|show_hn|ask_hn|comment] [--min-points 10] [--limit 20] [--recent]
python3 -I <skill>/scripts/hn.py thread <story id> [--limit 40]
```

1. **Show HN** for the topic's phrases (`--tags show_hn`): what individuals built, and the top comments' reactions to
   it (what people loved, what they asked for next).
2. **Ask HN** (`--tags ask_hn`): "How do you track/manage/learn X?", "What's your setup for…" — the comments are lists
   of real personal systems, often homemade. Try "how do you", "what do you use for", "personal <topic>".
3. **Stories** with `--min-points 50` for the big launches and essays in the space.
4. **Comments** search (`--tags comment`) with need phrases: "I wish", "I built my own", "killer feature",
   "the only thing I miss".
5. Read the best 5–8 threads (`thread`). Points and comment counts are the signal.

Look especially for people who built a **personal, self-hosted** version for themselves — that's tars's situation.
