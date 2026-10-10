#!/usr/bin/env python3
"""hn.py search "<query>" [--tags story|show_hn|ask_hn|comment] [--min-points N] [--limit 20] [--recent]
   hn.py thread <story id> [--limit 40]"""
import argparse, html, json, re, urllib.parse, urllib.request

API = "https://hn.algolia.com/api/v1"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "tars-idea-scout/0.1"})
    return json.load(urllib.request.urlopen(req, timeout=30))


def clean(s, limit):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    return s[:limit] + ("…" if len(s) > limit else "")


def search(a):
    q = {"query": a.query, "tags": a.tags, "hitsPerPage": a.limit}
    if a.min_points:
        q["numericFilters"] = f"points>={a.min_points}"
    hits = get(f"{API}/{'search_by_date' if a.recent else 'search'}?" + urllib.parse.urlencode(q))["hits"]
    for h in hits:
        hn = f"https://news.ycombinator.com/item?id={h['objectID']}"
        if a.tags == "comment":
            print(f"- [{h.get('created_at', '')[:10]}] on \"{h.get('story_title')}\": {clean(h.get('comment_text'), 500)}\n  {hn}")
        else:
            print(f"- {h.get('points') or 0} pts, {h.get('num_comments') or 0} comments ({h.get('created_at', '')[:10]}): "
                  f"{h.get('title')}\n  {hn}  {h.get('url') or ''}")


def thread(a):
    item = get(f"{API}/items/{a.id}")
    print(f"{item.get('title')} ({item.get('points')} pts)\n{item.get('url') or ''}\n{clean(item.get('text'), 1500)}\n")
    out = []

    def walk(node, depth):
        for c in node.get("children") or []:
            if len(out) >= a.limit:
                return
            if c.get("text"):
                out.append(f"{'  ' * depth}- {clean(c['text'], 600)}")
            if depth < 2:
                walk(c, depth + 1)

    walk(item, 0)
    print("\n".join(out))


p = argparse.ArgumentParser()
s = p.add_subparsers(dest="cmd", required=True)
ps = s.add_parser("search")
ps.add_argument("query")
ps.add_argument("--tags", default="story")
ps.add_argument("--min-points", type=int, default=0)
ps.add_argument("--limit", type=int, default=20)
ps.add_argument("--recent", action="store_true")
ps.set_defaults(fn=search)
pt = s.add_parser("thread")
pt.add_argument("id")
pt.add_argument("--limit", type=int, default=40)
pt.set_defaults(fn=thread)
args = p.parse_args()
args.fn(args)
