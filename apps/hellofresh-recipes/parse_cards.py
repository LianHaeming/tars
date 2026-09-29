#!/usr/bin/env python3
"""Read ingredient units and amounts from downloaded recipe-card PDFs into cards.json.

Usage:
    python3 parse_cards.py --sample 300   # try on a random sample and print a report
    python3 parse_cards.py                # all cards, then: python3 build_app.py

Also writes unit_hints.json: for ingredients whose verified cards always use one unit (e.g.
potatoes in grams), that unit and the quantity range seen, so build_app.py can add a unit to
amounts HelloFresh's data gives without one, even for recipes whose own card couldn't be used.

Nothing else is modified. A card row is only accepted when it can be tied to an ingredient in
recipes.json by name AND its 2-person amount equals the amount HelloFresh's data already has
(or the data has no amount). Anything else is recorded as rejected, never guessed.

How a card is read: pdftotext gives every word with its position. The ingredient and pantry
tables are found by their "2P 3P 4P" header; each word below it is assigned to the name column
or to the 2P/3P/4P column it sits under, and words further right (the method text) are ignored.
Units come either from the name ("Beef Mince (g)  240 360 480") or from the amounts themselves
("Green Beans  80g 120g 160g", "1 sachet", "3/4 large pot").
"""
import argparse
import html
import json
import random
import re
import subprocess
import unicodedata
from concurrent.futures import ProcessPoolExecutor

from build_app import unique_dishes
from fetch import ROOT

OUT = ROOT / "cards.json"
HINTS = ROOT / "unit_hints.json"
LINE_TOLERANCE = 3.0  # points: words this close vertically are on the same line
STOP_WORDS = ("Not Included", "Store in the Fridge", "Nutrition", "Allergens")
WORD_RE = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>')


# ---------- reading words and tables ----------

def pages(pdf):
    xml = subprocess.run(["pdftotext", "-bbox", str(pdf), "-"], capture_output=True, text=True, timeout=60).stdout
    for page in xml.split("<page ")[1:]:
        yield [(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in WORD_RE.findall(page)]


def lines_of(words):
    """Group words into lines by vertical position, each line sorted left to right."""
    lines = []
    for w in sorted(words, key=lambda w: (w[1], w[0])):
        if lines and abs(lines[-1][0] - w[1]) <= LINE_TOLERANCE:
            lines[-1][1].append(w)
        else:
            lines.append([w[1], [w]])
    return [(y, sorted(ws)) for y, ws in lines]


def headers(lines):
    """Table headers: (y, [(servings, column centre)], header text). Cards label columns
    "2P 3P 4P", "2P 4P", or (older) a single "2 PEOPLE"."""
    found = []
    for y, ws in lines:
        cols = [(int(w[4][0]), (w[0] + w[2]) / 2) for w in ws if re.fullmatch(r"[1-6]P", w[4])]
        if len(cols) < 2:
            cols = [(int(a[4]), (a[0] + b[2]) / 2) for a, b in zip(ws, ws[1:])
                    if re.fullmatch(r"[1-6]", a[4]) and b[4].upper() == "PEOPLE"]
        if cols and [c for c, _ in cols] == sorted({c for c, _ in cols}):
            found.append((y, sorted(cols, key=lambda c: c[1]), " ".join(w[4] for w in ws)))
    return found


def table_rows(lines, header, next_header_y):
    """Rows (name, [cell text per column]) under one header."""
    hy, cols, _ = header
    centres = [c for _, c in cols]
    gap = min((b - a for a, b in zip(centres, centres[1:])), default=60)  # single column: ~60pt wide
    # Some layouts put the table to the right of the method text. The table starts where its title
    # does ("Ingredients", "Pantry", "In order of use"): on the header line, or the line just above.
    title_line = [w[0] for y, ws in lines if abs(y - hy) <= 1 for w in ws if w[2] < centres[0] - 0.55 * gap]
    if not title_line:
        above = [(y, ws) for y, ws in lines if hy - 20 <= y < hy - 1]
        title_line = [w[0] for w in above[-1][1] if w[2] < centres[0]] if above else []
    left_edge = min(title_line) - 2 if title_line else 0
    # a single column sits next to the allergens column, so keep its right edge tight
    name_edge, right_edge = centres[0] - 0.55 * gap, centres[-1] + (0.6 if len(centres) > 1 else 0.5) * gap
    content = []  # (y, name, [cell per column])
    for y, ws in lines:
        if y <= hy + 1 or y >= next_header_y - 1:
            continue
        text = " ".join(w[4] for w in ws)
        if any(s in text for s in STOP_WORDS):
            break
        name, cells = [], [[] for _ in centres]
        for w in ws:
            centre = (w[0] + w[2]) / 2
            if centre > right_edge or w[0] < left_edge:
                continue  # method text beside the table
            if centre < name_edge:
                name.append(w[4])
            else:
                cells[min(range(len(centres)), key=lambda i: abs(centres[i] - centre))].append(w[4])
        name, cells = " ".join(name), [" ".join(c) for c in cells]
        if name or any(cells):
            content.append((y, name, cells))

    # Lines with amounts anchor rows. On older cards a name wraps over several lines with the
    # amounts centred between them ("Caramelised Onion" / "4 6 8" / "Sausages"), and amounts can
    # wrap too ("1 small" / "pack"), so assemble rows rather than reading line by line.
    anchors = [[y, [(y, name)] if name else [], cells] for y, name, cells in content if any(cells)]
    merged = []
    for a in anchors:
        # amounts with no number ("pack", "punnet") continue the amounts above
        if merged and not any(split_cell(c) for c in a[2] if c):
            prev = merged[-1]
            prev[1] += a[1]
            prev[2] = [f"{p} {c}".strip() for p, c in zip(prev[2], a[2])]
        else:
            merged.append(a)
    for y, name, cells in content:
        if any(cells) or not merged:
            continue
        nearest = min(merged, key=lambda a: (abs(a[0] - y), a[0] > y))  # ties go to the row above
        nearest[1].append((y, name))
    return [[" ".join(n for _, n in sorted(names)), cells] for _, names, cells in merged]


def card_tables(pdf):
    """All (kind, servings per column, rows) tables in a card; kind is 'ingredients' or 'pantry'."""
    tables = []
    for words in pages(pdf):
        lines = lines_of(words)
        hs = headers(lines)
        for i, h in enumerate(hs):
            next_y = hs[i + 1][0] if i + 1 < len(hs) else 1e9
            kind = "pantry" if "Pantry" in h[2] else "ingredients"
            tables.append((kind, [n for n, _ in h[1]], table_rows(lines, h, next_y)))
    return tables


# ---------- interpreting rows ----------

UNIT_WORDS = {"g": "g", "ml": "ml", "kg": "kg", "l": "l"}
# units a card may print; anything else in an amount means the cell picked up stray text
KNOWN_UNIT = re.compile(
    r"(?:(?:small|medium|large|big)\s+)?(?:g|kg|ml|l|tsp|tbsp|unit|sachet|carton|bunch|pot|pinch|cup|nest|"
    r"clove|pack|packet|ball|block|bag|punnet|tin|can|pouch|slice|pc|piece|fillet|rasher|stick|sprig|jar|tub|"
    r"bottle|sheet|knob|handful|head|leaf|leave|portion|thigh|breast|steak|sausage|wrap|tortilla|bun|"
    r"naan|flatbread|egg|drumstick)(?:e?s)?(?:\((?:s|es)\))?")


def number(s):
    """'240', '1.5', '1/2', '11/2' (1½ with the ½ flattened), '½' -> float."""
    s = s.strip().replace("½", ".5").replace("¼", ".25").replace("¾", ".75")
    if re.fullmatch(r"\d*\.\d+|\d+", s):
        return float(s)
    m = re.fullmatch(r"(\d*?)(\d)/([234])", s)
    if m:
        return (int(m.group(1)) if m.group(1) else 0) + int(m.group(2)) / int(m.group(3))
    return None


def split_cell(cell):
    """'80g' -> (80, 'g'); '1 sachet' -> (1, 'sachet'); '3/4 large pot' -> (0.75, 'large pot'); '2' -> (2, '')."""
    m = re.fullmatch(r"\s*([\d./½¼¾]+)\s*(.*?)\s*", cell)
    if not m or number(m.group(1)) is None:
        return None
    return number(m.group(1)), m.group(2)


def clean_name(raw):
    """Name without asterisks, allergen numbers and a trailing '(unit)'; also returns that unit."""
    unit = None
    m = re.search(r"\(([a-z]+(?:\((?:s|es)\))?)\)", raw)  # "(g)", "(sachet(s))", "(bunch(es))"
    if m:
        unit = m.group(1)
        raw = raw[:m.start()] + raw[m.end():]
    name = re.sub(r"\s+f$", "", raw.strip())  # older cards mark fridge items with a trailing "f"
    name = re.sub(r"\d+\)", "", name)
    name = re.sub(r"[*®™]", "", name)
    return " ".join(name.split()), unit


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()  # Crème Fraîche -> Creme Fraiche
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(w.rstrip("s") for w in s.split())


def fmt_number(x):
    whole, frac = int(x), round(x - int(x), 2)
    sym = {0.5: "½", 0.25: "¼", 0.75: "¾"}.get(frac)
    if frac == 0:
        return str(whole)
    if sym:
        return f"{whole}{sym}" if whole else sym
    return f"{x:g}"


def base_unit(unit):
    """'sachets' / 'sachet(s)' -> 'sachet(s)'; 'bunches' -> 'bunch(es)'; g, ml, tsp, tbsp unchanged; '' = a count."""
    unit = re.sub(r"\((s|es)\)$", "", unit.strip())
    if unit in ("", "unit") or unit in UNIT_WORDS or unit in ("tsp", "tbsp", "pc"):
        return "" if unit == "unit" else unit
    if unit.endswith(("ches", "shes", "xes")):
        return unit[:-2] + "(es)"
    return (unit[:-1] if unit.endswith("s") else unit) + "(s)"


def unit_hints(results, min_seen=5, agreement=0.95):
    """Per ingredient (normalised data name): the unit verified cards always use, and the range of
    quantities seen with it. Only ingredients seen min_seen+ times with one unit >= agreement."""
    seen = {}
    for res in results.values():
        for e in res.get("ingredients", {}).values():
            key = norm(e["data_name"])
            unit = e["unit"]
            if unit and norm(unit.split("(")[0]) in key.split():
                unit = ""  # "2 cloves" of "Garlic Clove" is just a count
            seen.setdefault(key, []).append((unit, list(e["qty"].values())))
    hints = {}
    for key, obs in seen.items():
        units = [u for u, _ in obs]
        top = max(set(units), key=units.count)
        if len(obs) >= min_seen and units.count(top) / len(obs) >= agreement:
            qtys = sorted(q for u, qs in obs if u == top for q in qs)
            lo, hi = qtys[int(0.02 * (len(qtys) - 1))], qtys[int(0.98 * (len(qtys) - 1))]  # ignore stray values
            hints[key] = {"unit": top, "seen": len(obs), "min": lo, "max": hi}
    return hints


def display(qty, unit):
    """How an amount is shown: 240g, 50ml, 2, 1 sachet, 2 sachets, 1½ tsp."""
    if unit in UNIT_WORDS:
        return f"{qty:g}{UNIT_WORDS[unit]}"  # 12.5g, not 12½g
    if not unit or unit == "unit(s)":
        return fmt_number(qty)
    m = re.fullmatch(r"(.+?)\((s|es)\)", unit)
    if m:
        unit = m.group(1) + (m.group(2) if qty > 1 else "")
    return f"{fmt_number(qty)} {unit}"


def match(name, candidates):
    """Ingredient id for a card name among {id: normalised API name}, only if unambiguous."""
    n = norm(name)
    exact = [i for i, c in candidates.items() if c == n]
    if len(exact) == 1:
        return exact[0]
    contains = [i for i, c in candidates.items() if c and (c in n or n in c)]
    if len(contains) == 1:
        return contains[0]
    nw = set(n.split())
    scored = sorted(((len(nw & set(c.split())) / len(nw | set(c.split())), i) for i, c in candidates.items() if c),
                    reverse=True)
    if scored and scored[0][0] >= 0.6 and (len(scored) == 1 or scored[1][0] < scored[0][0]):
        return scored[0][1]
    return None


def parse_card(job):
    recipe_id, pdf, recipe = job
    try:
        tables = card_tables(pdf)
    except Exception as e:
        return recipe_id, {"status": "unreadable", "error": type(e).__name__}
    if not tables:
        return recipe_id, {"status": "no table"}

    names = {i["id"]: i["name"] for i in recipe.get("ingredients") or []}
    api_amounts = {y["yields"]: {i["id"]: i.get("amount") for i in y["ingredients"]} for y in recipe.get("yields") or []}
    candidates = {i: norm(n) for i, n in names.items()}
    found, rejected = {}, []
    for kind, servings, rows in tables:
        for raw, cells in rows:
            name, unit = clean_name(raw)
            parsed = {n: split_cell(c) if c else None for n, c in zip(servings, cells)}
            parsed = {n: p for n, p in parsed.items() if p}
            if not parsed:
                rejected.append({"row": raw, "cells": cells, "why": "no amount"})
                continue
            units = {unit or p[1] for p in parsed.values()} - {""}
            if any(not KNOWN_UNIT.fullmatch(u) for u in units):
                rejected.append({"row": raw, "cells": cells, "why": f"unrecognised unit {sorted(units)}"})
                continue
            iid = match(name, {i: c for i, c in candidates.items() if i not in found})
            if not iid:
                rejected.append({"row": raw, "cells": cells, "why": "no matching ingredient"})
                continue
            # check against the data for the first serving size both have
            check = next((n for n in parsed if n in api_amounts and iid in api_amounts[n]), None)
            expected = api_amounts[check][iid] if check else None
            if expected is not None and abs(parsed[check][0] - float(expected)) > 0.02 * max(1, float(expected)):
                rejected.append({"row": raw, "cells": cells, "why": f"{check}P amount {parsed[check][0]:g} != data {expected}"})
                continue
            found[iid] = {
                "name": name,
                "data_name": names[iid],
                "unit": base_unit(unit or next(iter(parsed.values()))[1]),
                "qty": {str(n): p[0] for n, p in parsed.items()},
                "amounts": {str(n): display(p[0], unit or p[1]) for n, p in parsed.items()},
                "fridge": "**" in raw or bool(re.search(r"\sf$", raw.strip())),
                "pantry": kind == "pantry" or ("*" in raw.replace("**", "")),
            }
    total = len(names)
    status = "complete" if found and len(found) == total else "partial" if found else "no matches"
    return recipe_id, {"status": status, "matched": len(found), "of": total, "ingredients": found, "rejected": rejected}


# ---------- driver ----------

def jobs():
    """(recipe id, pdf path, recipe) for every downloaded card, keyed to the dish the app shows."""
    items = json.loads((ROOT / "recipes.json").read_text())
    return [(r["id"], ROOT / "pdfs" / f"{r['id']}.pdf", r) for r in unique_dishes(items)
            if (ROOT / "pdfs" / f"{r['id']}.pdf").exists()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, help="parse a random sample and report, without writing cards.json")
    args = ap.parse_args()
    todo = jobs()
    if args.sample:
        random.seed(1)
        todo = random.sample(todo, min(args.sample, len(todo)))
    print(f"parsing {len(todo)} cards…", flush=True)
    with ProcessPoolExecutor() as pool:
        results = dict(pool.map(parse_card, todo, chunksize=20))

    statuses, rows_ok, rows_total, reasons = {}, 0, 0, {}
    for res in results.values():
        statuses[res["status"]] = statuses.get(res["status"], 0) + 1
        rows_ok += res.get("matched", 0)
        rows_total += res.get("of", 0)
        for r in res.get("rejected", []):
            key = r["why"].split(" != ")[0]
            reasons[key] = reasons.get(key, 0) + 1
    print(f"cards: {statuses}")
    print(f"ingredients with a unit from the card: {rows_ok}/{rows_total} ({rows_ok / max(rows_total, 1):.0%})")
    print(f"rejected rows by reason: {reasons}")
    if args.sample:
        partial = [(k, v) for k, v in results.items() if v.get("rejected")][:4]
        for rid, v in partial:
            print(f"\n--- {rid}: {v['matched']}/{v['of']}")
            for r in v["rejected"][:5]:
                print(f"   rejected: {r['row']!r} {r['cells']} -> {r['why']}")
        return
    OUT.write_text(json.dumps(results, ensure_ascii=False))
    hints = unit_hints(results)
    HINTS.write_text(json.dumps(hints, ensure_ascii=False, indent=0))
    print(f"wrote {OUT} and {HINTS} ({len(hints)} ingredients with a consistent unit)")


if __name__ == "__main__":
    main()
