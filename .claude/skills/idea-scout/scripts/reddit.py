#!/usr/bin/env python3
"""reddit.py search "<query>" [--sub a,b] [--sort top|relevance|new|comments] [--t all|year|month] [--limit 15]
   reddit.py thread <post url> [--limit 30]

Exit 3 = rate-limited by Reddit."""
import argparse, hashlib, html, os, re, sys, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

UA = "Mozilla/5.0 (X11; Linux x86_64) tars-idea-scout/0.1 (personal research)"
GAP = 8  # seconds between requests
CACHE = os.path.join(os.environ.get("XDG_CACHE_HOME", os.path.expanduser("~/.cache")), "tars-idea-scout", "reddit")
NS = {"a": "http://www.w3.org/2005/Atom"}


def fetch(url):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + ".xml")
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < 86400:
        return open(path, "rb").read()
    stamp = os.path.join(CACHE, "last-request")
    for attempt in range(2):
        last = os.path.getmtime(stamp) if os.path.exists(stamp) else 0
        time.sleep(max(0, last + GAP - time.time()))
        open(stamp, "w").close()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            body = urllib.request.urlopen(req, timeout=30).read()
            open(path, "wb").write(body)
            return body
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt == 0:
                print("(429 from Reddit, waiting 60s)", file=sys.stderr)
                time.sleep(60)
                continue
            print(f"RATE_LIMITED or blocked: HTTP {e.code} for {url}", file=sys.stderr)
            sys.exit(3 if e.code == 429 else 2)


def text(node, limit):
    raw = node.text if node is not None and node.text else ""
    raw = html.unescape(re.sub(r"<[^>]+>", " ", html.unescape(raw)))
    raw = re.sub(r"\s+", " ", raw.replace("submitted by", "· by")).strip()
    return raw[:limit] + ("…" if len(raw) > limit else "")


def entries(body):
    root = ET.fromstring(body)
    for e in root.findall("a:entry", NS):
        link = e.find("a:link", NS)
        cat = e.find("a:category", NS)
        author = e.find("a:author/a:name", NS)
        yield {
            "title": text(e.find("a:title", NS), 200),
            "url": link.get("href") if link is not None else "",
            "sub": cat.get("label") if cat is not None else "",
            "date": (e.findtext("a:updated", "", NS) or e.findtext("a:published", "", NS))[:10],
            "author": author.text if author is not None else "",
            "content": e.find("a:content", NS),
        }


def search(a):
    q = {"q": a.query, "sort": a.sort, "t": a.t, "limit": a.limit}
    if a.sub:
        q["restrict_sr"] = "1"
        base = f"https://www.reddit.com/r/{a.sub.replace(',', '+')}/search.rss"
    else:
        base = "https://www.reddit.com/search.rss"
    for i, e in enumerate(entries(fetch(base + "?" + urllib.parse.urlencode(q))), 1):
        print(f"{i}. [{e['sub']}] {e['title']} ({e['date']})\n   {e['url']}\n   {text(e['content'], 300)}\n")


def thread(a):
    url = a.url.split("?")[0].rstrip("/") + ".rss?" + urllib.parse.urlencode({"limit": a.limit, "sort": "top"})
    for i, e in enumerate(entries(fetch(url))):
        if i == 0:
            print(f"POST [{e['sub']}] {e['title']} ({e['date']})\n{text(e['content'], 1500)}\n\nTOP COMMENTS")
        else:
            print(f"- {e['author']}: {text(e['content'], 700)}")


p = argparse.ArgumentParser()
s = p.add_subparsers(dest="cmd", required=True)
ps = s.add_parser("search")
ps.add_argument("query")
ps.add_argument("--sub", default="")
ps.add_argument("--sort", default="top")
ps.add_argument("--t", default="all")
ps.add_argument("--limit", type=int, default=15)
ps.set_defaults(fn=search)
pt = s.add_parser("thread")
pt.add_argument("url")
pt.add_argument("--limit", type=int, default=30)
pt.set_defaults(fn=thread)
args = p.parse_args()
args.fn(args)
