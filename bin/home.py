#!/usr/bin/env python3
"""Write home/index.html: a link to every app in apps/*/app.json."""
import html
import json
from pathlib import Path

TARS = Path(__file__).resolve().parent.parent

apps = sorted(
    (json.loads(p.read_text()) | {"dir": p.parent.name} for p in TARS.glob("apps/*/app.json")),
    key=lambda a: a["name"].lower(),
)
items = "\n".join(
    f'    <li><a data-port="{a["port"]}" href=":{a["port"]}/">{html.escape(a["name"])}<span>{a["dir"]} · :{a["port"]}</span></a></li>'
    for a in apps
)
(TARS / "home" / "index.html").write_text(f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="apple-mobile-web-app-title" content="tars">
  <title>tars</title>
  <style>
    :root {{ --bg: #f6f5f2; --card: #fff; --fg: #1d1d1b; --muted: #77756f; --line: #e4e2dc; }}
    @media (prefers-color-scheme: dark) {{ :root {{ --bg: #121212; --card: #1c1c1c; --fg: #ecebe8; --muted: #9a9892; --line: #2c2c2c; }} }}
    body {{ margin: 0; background: var(--bg); color: var(--fg); font: 17px/1.4 system-ui, -apple-system, sans-serif; }}
    main {{ max-width: 32rem; margin: 0 auto; padding: 2.5rem 16px; }}
    h1 {{ font-size: 1.6rem; margin: 0 0 1.25rem; letter-spacing: .02em; }}
    ul {{ list-style: none; margin: 0; padding: 0; display: grid; gap: .75rem; }}
    a {{ display: flex; flex-direction: column; gap: .15rem; padding: 1rem 1.1rem; background: var(--card);
         border: 1px solid var(--line); border-radius: 14px; color: inherit; text-decoration: none; font-weight: 600; }}
    a span {{ font-weight: 400; font-size: .85rem; color: var(--muted); }}
  </style>
</head>
<body>
  <main>
    <h1>tars</h1>
    <ul>
{items}
    </ul>
  </main>
  <script>
    for (const a of document.querySelectorAll("a[data-port]")) a.href = `https://${{location.hostname}}:${{a.dataset.port}}/`;
  </script>
</body>
</html>
""")
print(f"home: {len(apps)} apps")
