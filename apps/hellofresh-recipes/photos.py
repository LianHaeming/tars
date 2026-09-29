#!/usr/bin/env python3
"""Download a photo for every dish in the app, or a picture for every ingredient.

Usage:
    python3 photos.py && python3 build_app.py            # grid size (600px) -> photos/<id>.jpg
    python3 photos.py --large && python3 build_app.py    # header size (1200px) -> photos/large/<id>.jpg
    python3 photos.py --ingredients && python3 build_app.py   # ingredient pictures (160px) -> photos/ingredients/<id>.png

8 downloads at a time. Re-running skips photos already on disk. Stops if the server starts
refusing requests (HTTP 429/403/5xx) so we don't hammer it.
"""
import argparse
import json
import sys
import threading
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

from build_app import PHOTO, unique_dishes
from fetch import ROOT, get

WORKERS = 8
SIZES = {"grid": (600, ROOT / "photos"), "large": (1200, ROOT / "photos" / "large")}
INGREDIENTS = ROOT / "photos" / "ingredients"
MAX_REFUSALS = 20  # consecutive server refusals before giving up

stop = threading.Event()
lock = threading.Lock()
refusals = 0


def fetch(url, dest):
    global refusals
    if stop.is_set():
        return "stopped"
    try:
        body = get(url)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return "missing"
        with lock:
            refusals += 1
            if refusals >= MAX_REFUSALS:
                stop.set()
        time.sleep(5)
        return f"http {e.code}"
    except Exception as e:
        return f"error {type(e).__name__}"
    if body.lstrip().startswith(b"<"):  # an error page, not an image
        return "missing"
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(body)
    tmp.rename(dest)
    with lock:
        refusals = 0
    return "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--large", action="store_true", help="1200px header photos instead of 600px grid photos")
    ap.add_argument("--ingredients", action="store_true", help="160px ingredient pictures")
    args = ap.parse_args()
    dishes = unique_dishes(json.loads((ROOT / "recipes.json").read_text()))
    if args.ingredients:
        out = INGREDIENTS
        pictures = {i["id"]: i["imagePath"] for r in dishes for i in r.get("ingredients") or [] if i.get("imagePath")}
        jobs = [(PHOTO.format(w=160, path=path), out / f"{iid}.png") for iid, path in pictures.items()]
    else:
        width, out = SIZES["large" if args.large else "grid"]
        jobs = [(PHOTO.format(w=width, path=r["imagePath"]), out / f"{r['id']}.jpg") for r in dishes]
    out.mkdir(parents=True, exist_ok=True)
    todo = [(url, dest) for url, dest in jobs if not dest.exists()]
    print(f"{len(jobs)} pictures, {len(jobs) - len(todo)} already downloaded, {len(todo)} to fetch", flush=True)
    counts, start = {}, time.time()
    with ThreadPoolExecutor(WORKERS) as pool:
        for i, fut in enumerate(as_completed(pool.submit(fetch, url, dest) for url, dest in todo), 1):
            result = fut.result()
            counts[result] = counts.get(result, 0) + 1
            if i % 500 == 0 or i == len(todo):
                rate = i / (time.time() - start)
                print(f"  {i}/{len(todo)}  {rate:.1f}/s  ~{(len(todo) - i) / rate / 60:.0f} min left  {counts}", flush=True)
    if stop.is_set():
        print("STOPPED: the server kept refusing requests. Wait a while, then re-run to resume.")
        sys.exit(1)
    print(f"done: {counts}")


if __name__ == "__main__":
    main()
