#!/usr/bin/env python3
"""Download HelloFresh UK recipe metadata into recipes.json.

Usage:
    python3 fetch.py
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(os.environ.get("HF_DATA") or Path(__file__).resolve().parent)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
TOKEN_PAGE = "https://www.hellofresh.co.uk/recipes/r-667425d53d7908a0f17bb33f"
API = "https://gw.hellofresh.com/api/recipes/search?country=GB&locale=en-GB&take={take}&skip={skip}"
PAGE_SIZE = 250

# md5 of the "No picture available...yet" card HelloFresh serves for unreleased recipes
PLACEHOLDER_MD5S = {"cb671d20bc24109d1c2add648b5beb39"}


def get(url, headers=None, retries=3):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                raise
            err = e
        except (urllib.error.URLError, TimeoutError) as e:
            err = e
        time.sleep(5 * (attempt + 1))
    raise err


def get_token():
    html = get(TOKEN_PAGE).decode()
    return re.search(r'"access_token":\s*"([^"]+)"', html).group(1)


def minutes(iso):
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?", iso or "")
    return int(m.group(1) or 0) * 60 + int(m.group(2) or 0) if m else 0


# The API refuses to page past 10,000 results (skip + take > 10k -> HTTP 500), so the catalogue
# is fetched as overlapping slices, each read oldest-first and newest-first (up to 20k per slice).
SEARCH_WINDOW = 10_000
SLICES = (
    ["difficulty=0", "difficulty=2", "difficulty=3", "difficulty=1"]
    + [f"difficulty=1&max-prep-time={m}" for m in (15, 20, 25, 30, 35, 40, 50)]
    + [f"difficulty=1&max-calories={c}" for c in (400, 500, 600, 700, 800, 900)]
)


def fetch_slice(query, auth, recipes):
    for sort in ("date", "-date"):
        skip = 0
        while skip < SEARCH_WINDOW:
            take = min(PAGE_SIZE, SEARCH_WINDOW - skip)
            data = json.loads(get(API.format(take=take, skip=skip) + f"&{query}&sort={sort}", auth))
            for r in data["items"]:
                recipes[r["id"]] = r
            skip += take
            time.sleep(0.5)
            if skip >= data["total"]:
                return data["total"]  # the whole slice fit in one pass
    return data["total"]


def fetch_metadata():
    auth = {"Authorization": f"Bearer {get_token()}"}
    total = json.loads(get(API.format(take=1, skip=0), auth))["total"]
    recipes = {}
    for query in SLICES:
        n = fetch_slice(query, auth, recipes)
        # save after every slice so an interrupted run keeps what it has
        (ROOT / "recipes.json").write_text(json.dumps(list(recipes.values()), ensure_ascii=False))
        print(f"  {query}: {n} in slice, {len(recipes)}/{total} collected", flush=True)
        if len(recipes) >= total:
            break
    items = list(recipes.values())
    print(f"saved {len(items)} of {total} recipes to recipes.json")
    return items


def cook_time(r):
    # The two fields disagree for most recipes; the card's printed time matches the larger one
    # (e.g. Creamy Fish Curry: prepTime 40, totalTime 15, card says 40 mins).
    return max(minutes(r.get("totalTime")), minutes(r.get("prepTime")))


FILLER_WORDS = {"and", "with", "a", "the", "of", "in", "on", "style"}


def dish_key(r):
    """Identify a dish across weekly re-runs: name + subtitle, ignoring word order, plurals,
    '&' vs 'and', ® and bracketed notes. 'Butterflied Chicken with Refried Beans' and
    'Butterflied Chicken with New Potatoes' stay separate dishes."""
    def words(s):
        s = re.sub(r"\([^)]*\)", "", (s or "").lower().replace("&", " and "))
        return tuple(sorted({w.rstrip("s") for w in re.findall(r"[a-z]+", s)} - FILLER_WORDS))
    return words(r["name"]), words(r.get("headline"))


def main():
    fetch_metadata()


if __name__ == "__main__":
    sys.exit(main())
