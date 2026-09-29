#!/usr/bin/env python3
"""Download recipe-card PDFs in batches, highest rated first, into pdfs/<id>.pdf.

Usage:
    python3 pdfs.py              # next 1000 dishes without a PDF, then: python3 build_app.py
    python3 pdfs.py -n 500 --min-ratings 50

Ranking is rating, then number of ratings, over the same dishes the app shows, ignoring dishes
with fewer than --min-ratings ratings (a 5.0 from 3 people says little). Each run continues where
the last one stopped: dishes already downloaded or known to have
no real card (pdfs/skipped.json) are passed over. When a dish's card is only a placeholder,
other weekly copies of the same dish are tried.

    python3 pdfs.py --retry      # retry only previously skipped dishes (placeholders, errors)
"""
import argparse
import hashlib
import json
import threading
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

from build_app import unique_dishes
from fetch import PLACEHOLDER_MD5S, ROOT, dish_key, get

OUT = ROOT / "pdfs"
SKIPPED = OUT / "skipped.json"
WORKERS = 4  # PDFs come from the main website, not the image CDN, so go gentler than photos.py
MAX_REFUSALS = 10

stop = threading.Event()
lock = threading.Lock()
refusals = 0


def fetch(r, copies):
    """Try the dish's card, then other weekly copies of it: some copies only have a placeholder."""
    result = None
    for link in [r["cardLink"]] + [c["cardLink"] for c in copies]:
        result = fetch_card(r, link)
        if result[0] not in ("no card", "placeholder"):
            return result
    return result


def fetch_card(r, link):
    global refusals
    if stop.is_set():
        return "stopped", None
    try:
        body = get(link)
    except urllib.error.HTTPError as e:
        if e.code in (403, 404):  # the site answers 403 for cards that don't exist
            return "no card", None
        with lock:
            refusals += 1
            if refusals >= MAX_REFUSALS:
                stop.set()
        time.sleep(5)
        return f"http {e.code}", None
    except Exception as e:
        return f"error {type(e).__name__}", None
    with lock:
        refusals = 0
    if hashlib.md5(body).hexdigest() in PLACEHOLDER_MD5S or not body.startswith(b"%PDF"):
        return "placeholder", None
    dest = OUT / f"{r['id']}.pdf"
    tmp = dest.with_suffix(".pdf.part")
    tmp.write_bytes(body)
    tmp.rename(dest)
    return "ok", len(body)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=1000)
    ap.add_argument("--min-ratings", type=int, default=100)
    ap.add_argument("--retry", action="store_true", help="only retry dishes skipped by earlier runs")
    args = ap.parse_args()

    OUT.mkdir(exist_ok=True)
    skipped = json.loads(SKIPPED.read_text()) if SKIPPED.exists() else {}
    items = json.loads((ROOT / "recipes.json").read_text())
    copies = {}
    for r in items:
        if r.get("cardLink"):
            copies.setdefault(dish_key(r), []).append(r)

    ranked = sorted(
        (r for r in unique_dishes(items) if r.get("cardLink") and (r.get("ratingsCount") or 0) >= args.min_ratings),
        key=lambda r: (r["averageRating"], r["ratingsCount"]), reverse=True)
    todo = [r for r in ranked
            if not (OUT / f"{r['id']}.pdf").exists()
            and (r["id"] in skipped if args.retry else r["id"] not in skipped)]
    if args.retry:
        for r in todo:
            skipped.pop(r["id"])
    done_before = len(ranked) - len(todo)
    print(f"{len(ranked)} dishes with {args.min_ratings}+ ratings; {done_before} already handled; "
          f"fetching the next {min(args.n, len(todo))}", flush=True)

    counts, size, start = {}, 0, time.time()
    batch = todo[:args.n]
    with ThreadPoolExecutor(WORKERS) as pool:
        futures = {}
        for r in batch:
            others = sorted((c for c in copies.get(dish_key(r), []) if c["id"] != r["id"]),
                            key=lambda c: c.get("ratingsCount") or 0, reverse=True)[:5]
            futures[pool.submit(fetch, r, others)] = r
        for i, fut in enumerate(as_completed(futures), 1):
            result, n = fut.result()
            counts[result] = counts.get(result, 0) + 1
            size += n or 0
            if result in ("no card", "placeholder"):
                skipped[futures[fut]["id"]] = result
            if i % 100 == 0 or i == len(batch):
                rate = i / (time.time() - start)
                print(f"  {i}/{len(batch)}  {rate:.1f}/s  {size / 1e6:.0f} MB  ~{(len(batch) - i) / rate / 60:.0f} min left  {counts}",
                      flush=True)
    SKIPPED.write_text(json.dumps(skipped))

    last = batch[-1] if batch else None
    if last:
        print(f"this batch went down to {last['averageRating'] * 1.25:.2f}/5 ({last['ratingsCount']} ratings)")
    if stop.is_set():
        print("STOPPED: the server kept refusing requests. Wait a while, then re-run to resume.")
    print(f"done: {counts}; {len(todo) - len(batch)} dishes left for later batches")


if __name__ == "__main__":
    main()
