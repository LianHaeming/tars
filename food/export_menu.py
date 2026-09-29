#!/usr/bin/env python3
"""Refresh this folder's menu data from the full archive (run on the Mac, where the archive lives).

Copies my-menu.json, the shop mappings and unit hints, cuts recipes.json and cards.json down to the
dishes kept in my-menu.json, and replaces photos/ with just those dishes' photos.

Usage:
    HF_DATA=~/dev/hellofresh-recipes python3 export_menu.py
"""
import glob
import json
import os
import shutil
import sys
from pathlib import Path

from fetch import ROOT

HERE = Path(__file__).resolve().parent


def main():
    if ROOT == HERE:
        sys.exit("set HF_DATA to the full archive folder, e.g. HF_DATA=~/dev/hellofresh-recipes")
    for name in ("my-menu.json", "sainsburys.json", "ocado.json", "unit_hints.json"):
        shutil.copy(ROOT / name, HERE / name)
    ids = set(json.loads((ROOT / "my-menu.json").read_text())["kept"])

    recipes = [r for r in json.loads((ROOT / "recipes.json").read_text()) if r["id"] in ids]
    missing = ids - {r["id"] for r in recipes}
    if missing:
        sys.exit(f"not in the archive: {sorted(missing)}")
    (HERE / "recipes.json").write_text(json.dumps(recipes, ensure_ascii=False))
    cards = json.loads((ROOT / "cards.json").read_text())
    (HERE / "cards.json").write_text(json.dumps({k: v for k, v in cards.items() if k in ids}, ensure_ascii=False))

    shutil.rmtree(HERE / "photos", ignore_errors=True)
    for sub in ("large", "steps", "ingredients"):
        (HERE / "photos" / sub).mkdir(parents=True)
    wanted = [p for rid in ids for p in (f"photos/{rid}.jpg", f"photos/large/{rid}.jpg",
                                         *(os.path.relpath(s, ROOT) for s in glob.glob(str(ROOT / f"photos/steps/{rid}-*.jpg"))))]
    wanted += {f"photos/ingredients/{i['id']}.png" for r in recipes for i in r.get("ingredients") or []}
    copied = 0
    for rel in wanted:
        if (ROOT / rel).exists():
            shutil.copy(ROOT / rel, HERE / rel)
            copied += 1
    print(f"exported {len(recipes)} dishes, {copied} photos into {HERE}")


if __name__ == "__main__":
    main()
