"""Variety tags (carb family, carb style, cuisine, protein) and ingredient helpers for a dish."""
import re

CARBS = [
    ("Pasta", r"spaghetti|linguine|penne|rigatoni|tagliatelle|fusilli|macaroni|orzo|pappardelle|lasagne|"
              r"gnocchi|ravioli|tortellini|tortelloni|fettuccine|conchigl|orecchiette|ditali|bucatini|"
              r"cappellacci|casarecce|farfalle|\bpasta\b"),
    ("Noodles", r"noodle|udon|ramen|vermicelli"),
    ("Rice", r"\brice\b(?! (?:vinegar|wine|noodle))|risotto"),
    ("Grains", r"couscous|bulgur|quinoa|freekeh|barley|polenta"),
    ("Bread", r"ciabatta|tortilla(?! chip)|\bbuns?\b|naan|flatbread|pitt?a|baguette|focaccia|foccacia|bao|"
              r"\bwraps?\b|chapati|\bbap\b|\brolls?\b|pizza dough|\bbread\b(?!crumb)|brioche|crumpet|sourdough"),
    ("Potato", r"potato|fries|wedges|\bmash\b|hash brown"),
]
CARB_RE = [(fam, re.compile(rx, re.I)) for fam, rx in CARBS]
STYLE_DROP = re.compile(r"\b(wheat|wholewheat|wholemeal|fresh|dried|plain|british|pre-cooked|steamed|super soft|"
                        r"del verde|small|diced|pasta|with whole wheat)\b", re.I)

STYLE_NAMES = {"egg noodle nest": "egg noodles", "udon noodles": "udon", "basmati rice": "basmati",
               "brown basmati rice": "basmati", "jasmine rice": "jasmine", "risotto rice": "risotto",
               "arborio rice": "risotto", "sushi rice": "sticky rice", "salad potatoes": "new potatoes",
               "baking potato": "jacket potato", "taco tortillas": "tortillas"}

PROTEINS = [
    ("Fish", r"salmon|\bcod\b|basa|haddock|hake|tuna|prawn|mackerel|trout|sea bass|seabass|pollock|\bfish\b|"
             r"king prawns|scallop|mussel|squid|crab"),
    ("Poultry", r"chicken|turkey|duck"),
    ("Beef", r"\bbeef\b|steak|brisket"),
    ("Lamb", r"\blamb\b"),
    ("Pork", r"pork|sausage|bacon|chorizo|\bham\b|pancetta|prosciutto|nduja|salami"),
]
PROTEIN_RE = [(p, re.compile(rx, re.I)) for p, rx in PROTEINS]
CATEGORY_PROTEIN = {"Poultry": "Poultry", "Seafood": "Fish", "Beef": "Beef", "Pork": "Pork",
                    "Lamb": "Lamb", "Veggie": "Veggie"}

CUISINE_NAMES = {
    "Cajunsk": "Cajun", "Brasiliansk": "Brazilian", "Peruansk": "Peruvian", "Sri Lankesisk": "Sri Lankan",
    "Malaysisk": "Malaysian", "Argentinsk": "Argentinian", "Jamaicansk": "Jamaican", "Belgisk": "Belgian",
    "Zanzibarisk": "Zanzibari", "Skandinavisk": "Scandinavian", "Ungersk": "Hungarian", "Israelisk": "Israeli",
    "Svensk": "Swedish", "Dansk": "Danish", "Fusion cuisine": "Fusion",
}

SKIP = re.compile(r"^(boiled |boiling |reserved )?(pasta |potato |rice )?water\b|^rice water", re.I)
FOR_THE = re.compile(r"\s+for (the\s+)?\w.*$", re.I)


def clean(name):
    return re.sub(r"\s+", " ", name.replace("®", "").replace("™", "")).strip()


def shop_name(name):
    """The name an ingredient is bought under: 'Sugar for the Sauce' -> 'Sugar'. None for water."""
    if SKIP.search(name):
        return None
    return clean(FOR_THE.sub("", name)) or clean(name)


def carb(names):
    """(family, style) of the dish's main carb, e.g. ('Pasta', 'Rigatoni'); ('Other', '') if none."""
    for fam, rx in CARB_RE:
        for n in names:
            if rx.search(n) and not re.search(r"breadcrumb|panko|crouton|flour|vinegar|wine|chips", n, re.I):
                style = (" ".join(STYLE_DROP.sub(" ", n).split()) or n).lower()
                if re.search(r"ravioli|tortel|filled|cappellacci", style):
                    style = "filled pasta"
                return fam, STYLE_NAMES.get(style, style).capitalize()
    return "Other", ""


MEAT_FREE = re.compile(r"vegetarian|plant.based|meatless|meat.free|vegan|linda mccartney|vivera|quorn|"
                       r"unconventional|veggie ['‘]?(sausage|meatball|mince|burger|chicken)", re.I)
NOT_PROTEIN = re.compile(r"stock|gravy|powder|paste|seasoning|\bjus\b|sauce|fat|oil|mayo|cheese|pesto|dressing", re.I)


def protein(title, names, category):
    """Main protein: from the dish's name first, then its ingredients, then HelloFresh's category."""
    if MEAT_FREE.search(title):
        return "Veggie"
    for text in [[title], [n for n in names if not NOT_PROTEIN.search(n) and not MEAT_FREE.search(n)]]:
        for p, rx in PROTEIN_RE:
            if any(rx.search(n) for n in text):
                return p
    return CATEGORY_PROTEIN.get(category, "Veggie")


def cuisine(cuisines):
    names = [CUISINE_NAMES.get(c, c) for c in cuisines]
    specific = [c for c in names if c not in ("Fusion", "European", "Western European", "Southern European")]
    return (specific or names or ["Other"])[0]


def dish_tags(r):
    """{'cf', 'cs', 'cu', 'p'} for a raw recipe from recipes.json."""
    names = [i["name"] for i in r.get("ingredients") or [] if shop_name(i["name"])]
    cat = r.get("category")
    cat = cat.get("name") if isinstance(cat, dict) else cat
    fam, style = carb(names)
    return {"cf": fam, "cs": style, "cu": cuisine([c["name"] for c in r.get("cuisines") or []]),
            "p": protein(r["name"], names, cat)}


UNIT_ALIASES = {"grams": "g", "gram": "g", "milliliter": "ml", "milliliters": "ml", "unit": "", "units": ""}
AMOUNT = re.compile(r"^\s*([\d.]+)\s*(.*?)\s*$")
FRACTIONS = {"½": ".5", "¼": ".25", "¾": ".75", "⅓": ".333", "⅔": ".667"}


def parse_amount(text):
    """'240g' -> (240, 'g'), '1½ tsp' -> (1.5, 'tsp'), '2 sachets' -> (2, 'sachet'). None if unparseable."""
    t = text or ""
    for sym, dec in FRACTIONS.items():
        t = re.sub(rf"(\d?){sym}", lambda m: (m.group(1) or "0") + dec, t)
    m = AMOUNT.match(t)
    if not m:
        return None
    unit = re.sub(r"\((?:s|es)\)$", "", m.group(2).lower()).strip()
    unit = UNIT_ALIASES.get(unit, unit)
    if unit.endswith("es") and unit[:-2] in ("pouch", "bunch"):
        unit = unit[:-2]
    elif unit.endswith("s") and unit not in ("g", "ml") and len(unit) > 3:
        unit = unit[:-1]
    try:
        return float(m.group(1)), unit
    except ValueError:
        return None
