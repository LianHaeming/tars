#!/usr/bin/env python3
"""Download the method (step-by-step) photos for every dish into photos/steps/<id>-<step>.jpg.

Usage:
    python3 steps.py && python3 build_app.py

8 downloads at a time, 600px wide. Re-running skips photos already on disk. Stops if the
server starts refusing requests.
"""
import json
import sys
import threading
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

from build_app import STEP_IMG, unique_dishes
from fetch import ROOT, get

WORKERS = 8
OUT = ROOT / "photos" / "steps"
MAX_REFUSALS = 20

stop = threading.Event()
lock = threading.Lock()
refusals = 0


def step_photo_path(recipe_id, step_index):
    return OUT / f"{recipe_id}-{step_index + 1}.jpg"


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
    tmp = dest.with_suffix(".jpg.part")
    tmp.write_bytes(body)
    tmp.rename(dest)
    with lock:
        refusals = 0
    return "ok"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    dishes = unique_dishes(json.loads((ROOT / "recipes.json").read_text()))
    jobs = [(STEP_IMG.format(path=s["images"][0]["path"]), step_photo_path(r["id"], i))
            for r in dishes for i, s in enumerate(r["steps"]) if s.get("images")]
    todo = [(u, d) for u, d in jobs if not d.exists()]
    print(f"{len(jobs)} step photos, {len(jobs) - len(todo)} already downloaded, {len(todo)} to fetch", flush=True)
    counts, start = {}, time.time()
    with ThreadPoolExecutor(WORKERS) as pool:
        for i, fut in enumerate(as_completed(pool.submit(fetch, u, d) for u, d in todo), 1):
            result = fut.result()
            counts[result] = counts.get(result, 0) + 1
            if i % 5000 == 0 or i == len(todo):
                rate = i / (time.time() - start)
                print(f"  {i}/{len(todo)}  {rate:.1f}/s  ~{(len(todo) - i) / rate / 60:.0f} min left  {counts}", flush=True)
    if stop.is_set():
        print("STOPPED: the server kept refusing requests. Wait a while, then re-run to resume.")
        sys.exit(1)
    print(f"done: {counts}")


if __name__ == "__main__":
    main()
