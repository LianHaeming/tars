#!/usr/bin/env python3
"""Build app/data/ (JSON for the Food pages of the tars app, app/web) from recipes.json and the downloaded files.

Usage:
    python3 build_app.py
"""
import html
import json
import re
import shutil

from fetch import ROOT, cook_time, dish_key
from tags import clean, dish_tags, parse_amount, shop_name

APP = ROOT / "app"
PHOTO = "https://img.hellofresh.com/f_auto,fl_lossy,q_auto,w_{w}/hellofresh_s3{path}"
STEP_IMG = "https://img.hellofresh.com/f_auto,fl_lossy,q_auto,w_600/hellofresh_s3{path}"


def unique_dishes(items):
    """Real meals only (no add-ons), one per dish (see dish_key), keeping the copy with the most ratings."""
    best = {}
    for r in items:
        if r.get("isAddon") or not r.get("steps") or not r.get("imagePath"):
            continue
        key = dish_key(r)
        if key not in best or (r.get("ratingsCount") or 0) > (best[key].get("ratingsCount") or 0):
            best[key] = r
    return list(best.values())


def fmt_amount(a):
    if a is None:
        return ""
    return str(int(a)) if float(a).is_integer() else str(a)


def data_amount(name, amount, unit, hints):
    """Amount from HelloFresh's data, adding a unit from unit_hints.json when the data has none and
    this ingredient's verified cards always use one unit for amounts in this range."""
    from parse_cards import display, norm
    if unit or amount is None:
        return " ".join(x for x in (fmt_amount(amount), unit or "") if x)
    hint = hints.get(norm(name))
    # the range guard rules out e.g. an amount of 1 (a pack) for something the cards give in grams
    if hint and 0.4 * hint["min"] <= float(amount) <= 2.5 * hint["max"]:
        return display(float(amount), hint["unit"])
    return fmt_amount(amount)


def ingredients(r, card, hints):
    """Ingredients for 2 servings (or the smallest size the recipe has). Amounts read from the recipe
    card (see parse_cards.py) are used where available since they include units."""
    names = {i["id"]: i["name"] for i in r.get("ingredients") or []}
    pictures = {i["id"]: i.get("imagePath") for i in r.get("ingredients") or []}
    yields = sorted(r.get("yields") or [], key=lambda y: (y["yields"] != 2, y["yields"]))
    if not yields:
        return []
    from_card = (card or {}).get("ingredients", {})
    rows = []
    for i in yields[0]["ingredients"]:
        if i["id"] not in names:
            continue
        name = names[i["id"]]
        amount = (from_card.get(i["id"], {}).get("amounts", {}).get(str(yields[0]["yields"]))
                  or data_amount(name, i.get("amount"), i.get("unit"), hints))
        qty = parse_amount(amount)
        rows.append({"name": clean(name), "amount": amount, "buy": shop_name(name),
                     "q": qty[0] if qty else None, "u": qty[1] if qty else None,
                     "img": local(f"photos/ingredients/{i['id']}.png", f"/food/photos/ingredients/{i['id']}.png")
                     or (PHOTO.format(w=160, path=pictures[i["id"]]) if pictures[i["id"]] else None)})
    return rows


NOTE = re.compile(r"(?:<strong>)?\s*(TIP|IMPORTANT)\s*:\s*(?:</strong>)?", re.I)
KEEP_TAG = re.compile(r"(</?(?:strong|em)>)")
SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[A-Z])")


def tidy(text):
    """Only <strong>/<em> kept (other tags dropped, <br> -> space), entities decoded once and re-escaped,
    spaces moved outside tags, whitespace collapsed."""
    text = re.sub(r"<br\s*/?>", " ", text)
    text = re.sub(r"<(/?)b>", r"<\1strong>", text)
    text = re.sub(r"<(/?)i>", r"<\1em>", text)
    text = re.sub(r"<(?!/?(?:strong|em)>)[^>]*>", "", text)
    text = "".join(part if KEEP_TAG.fullmatch(part) else html.escape(html.unescape(html.unescape(part)), quote=False)
                   for part in KEEP_TAG.split(text))
    text = re.sub(r"<(strong|em)>(\s+)", r"\2<\1>", text)
    text = re.sub(r"(\s+)</(strong|em)>", r"</\2>\1", text)
    text = re.sub(r"<(strong|em)>\s*</\1>", " ", text)
    text = re.sub(r"</(strong|em)><\1>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return re.sub(r"\s+([.,;:!?)])", r"\1", text)


def method_step(source):
    """A step's text as {'points': [...], 'notes': [{'kind': 'tip'|'important', 'text'}]}, whatever format
    HelloFresh wrote it in (a) b) c) paragraphs, bullet lists, plain paragraphs or plain sentences)."""
    blocks = re.findall(r"<li[^>]*>(.*?)</li>", source, re.S) or re.findall(r"<p[^>]*>(.*?)</p>", source, re.S) or [source]
    blocks = [tidy(b) for b in blocks]
    if len(blocks) == 1:
        blocks = SENTENCE.split(blocks[0])
    points, notes = [], []
    for block in blocks:
        parts = NOTE.split(block)
        lead = re.sub(r"^(?:<strong>)?\s*[a-h]\)\s*(?:</strong>)?\s*|^[•\-–]\s*", "", parts[0]).strip()
        if lead and lead != "Enjoy!":
            points.append(lead)
        for kind, text in zip(parts[1::2], parts[2::2]):
            em = re.match(r"\s*<em>(.*?)</em>(.*)$", text)
            note, rest = (em.group(1), em.group(2)) if em else (text, "")
            if note.strip():
                notes.append({"kind": kind.lower(), "text": re.sub(r"</?em>", "", note).strip()})
            if rest.strip() and rest.strip() != "Enjoy!":
                points.append(rest.strip())
    return {"points": points, "notes": notes}


def step_image(rid, i, step):
    """Local method photo from photos/steps/ (see steps.py) if downloaded, else HelloFresh's."""
    if not step.get("images"):
        return None
    if (ROOT / "photos" / "steps" / f"{rid}-{i + 1}.jpg").exists():
        return f"/food/photos/steps/{rid}-{i + 1}.jpg"
    return STEP_IMG.format(path=step["images"][0]["path"])


def local(path, rel):
    return rel if (ROOT / path).exists() else None


def dump(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


def main():
    items = json.loads((ROOT / "recipes.json").read_text())
    cards = json.loads((ROOT / "cards.json").read_text())
    hints = json.loads((ROOT / "unit_hints.json").read_text())

    detail_dir = APP / "data" / "r"
    if detail_dir.exists():
        shutil.rmtree(detail_dir)
    detail_dir.mkdir(parents=True)

    index = []
    for r in unique_dishes(items):
        rid = r["id"]
        kcal = next((n["amount"] for n in r.get("nutrition") or [] if n["name"] == "Energy (kcal)"), None)
        index.append({
            "id": rid,
            "n": clean(r["name"]),
            "h": clean(r.get("headline") or ""),
            "r": round((r.get("averageRating") or 0) * 1.25, 2),  # API rates out of 4
            "rc": r.get("ratingsCount") or 0,
            "m": cook_time(r),
            "d": r.get("difficulty") or 0,
            "k": kcal,
            "i": sorted({clean(i["name"]) for i in r.get("ingredients") or []}),
            "img": local(f"photos/{rid}.jpg", f"/food/photos/{rid}.jpg") or PHOTO.format(w=600, path=r["imagePath"]),
            **dish_tags(r),
        })
        detail = {
            "id": rid,
            "photo": local(f"photos/large/{rid}.jpg", f"/food/photos/large/{rid}.jpg") or PHOTO.format(w=1200, path=r["imagePath"]),
            "nutrition": [[n["name"], n["amount"], n.get("unit") or ""] for n in r.get("nutrition") or []
                          if n["name"] != "Energy (kJ)" and n.get("amount") is not None],
            "ingredients": ingredients(r, cards.get(rid), hints),
            "steps": [
                {**method_step(s.get("instructionsHTML") or s.get("instructionsMarkdown") or s.get("instructions") or ""),
                 "image": step_image(rid, i, s),
                 "title": s["images"][0].get("caption", "") if s.get("images") else ""}
                for i, s in enumerate(r.get("steps") or [])
            ],
        }
        dump(detail_dir / f"{rid}.json", detail)

    data = APP / "data"
    dump(data / "recipes.json", index)
    for name in ("my-menu", "sainsburys", "ocado"):
        dump(data / f"{name}.json", json.loads((ROOT / f"{name}.json").read_text()))
    for old in data.glob("*.js"):
        old.unlink()
    for old in ("index.html", "build.html", "common.js", "common.css"):
        (APP / old).unlink(missing_ok=True)
    print(f"wrote {len(index)} dishes to {data}")


if __name__ == "__main__":
    main()
