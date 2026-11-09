"""
Read and update product descriptions in the Railway Strapi, for the /describe command in Claude Code.

    tools\\venv\\Scripts\\python tools\\describe\\strapi_desc.py list             # every product + what its description lacks
    tools\\venv\\Scripts\\python tools\\describe\\strapi_desc.py show SLUG        # current text + downloads the main photo
    tools\\venv\\Scripts\\python tools\\describe\\strapi_desc.py update SLUG FILE # replace the description with FILE's text

`update` saves the old text to tools/describe/backups/ first, then saves and publishes the product.
The site only changes after a rebuild (tray: Deploy Preview, then Publish Live).

Needs in frontend/.env.railway:
  RAILWAY_STRAPI_URL    e.g. https://cms.tysondrawsstuff.com
  STRAPI_WRITE_TOKEN    Strapi admin > Settings > API Tokens, Custom: Product find, findOne, update
"""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
ENV_FILE = HERE.parent.parent / ".env.railway"
CACHE = HERE / ".cache"
BACKUPS = HERE / "backups"

SPEC_YEAR = re.compile(r"^(?:(?:made|painted|drawn)\s+(?:in\s+)?)?(?:19|20)\d{2}$", re.I | re.M)


def env() -> dict:
    vals = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$", line)
        if m:
            vals[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return vals


E = env()
BASE = (E.get("RAILWAY_STRAPI_URL") or "https://cms.tysondrawsstuff.com").rstrip("/")
TOKEN = E.get("STRAPI_WRITE_TOKEN")


def headers() -> dict:
    return {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}


def get(path: str, params: dict) -> dict:
    r = requests.get(BASE + path, params=params, headers=headers(), timeout=60)
    r.raise_for_status()
    return r.json()


def products() -> list[dict]:
    """Every product, newest first. With a token this includes unpublished (hidden) ones; each row gets
    `live: True/False` for whether it's published on the site."""
    params = {"pagination[limit]": 200, "sort[0]": "createdAt:desc",
              "populate[category][fields][0]": "name", "populate[images][fields][0]": "url"}
    published = get("/api/products", {**params, "status": "published"})["data"]
    if not TOKEN:
        return [{**p, "live": True} for p in published]
    live_ids = {p["documentId"] for p in published}
    drafts = get("/api/products", {**params, "status": "draft"})["data"]  # latest text of every product
    # The write token only covers Product, so categories come from the public API (published only);
    # hidden products fall back to their title.
    r = requests.get(BASE + "/api/products", params={"pagination[limit]": 200,
                                                      "populate[category][fields][0]": "name"}, timeout=60)
    cats = {p["documentId"]: p.get("category") for p in r.json()["data"]} if r.ok else {}
    out = []
    for p in drafts:
        cat = cats.get(p["documentId"])
        if not cat and re.search(r"original art", p["title"], re.I):
            cat = {"name": "Original Art"}
        out.append({**p, "category": cat, "live": p["documentId"] in live_ids})
    return out


def photo_path(p: dict) -> Path | None:
    """Downloads (once) and returns the product's main photo."""
    imgs = p.get("images") or []
    if not imgs:
        return None
    url = imgs[0]["url"]
    url = url if url.startswith("http") else BASE + url
    CACHE.mkdir(exist_ok=True)
    out = CACHE / f"{p['slug']}{Path(url.split('?')[0]).suffix or '.jpg'}"
    if not out.exists():
        out.write_bytes(requests.get(url, timeout=120).content)
    return out


def update_description(p: dict, text: str) -> str:
    """Backs up the old text, saves the new one. Published products are re-published; hidden ones stay
    hidden (only their draft changes). Returns the saved text."""
    if not TOKEN:
        raise RuntimeError("STRAPI_WRITE_TOKEN is missing from frontend/.env.railway")
    text = text.strip() + "\n"
    BACKUPS.mkdir(exist_ok=True)
    (BACKUPS / f"{p['slug']}-{time.strftime('%Y%m%d-%H%M%S')}.txt").write_text(p.get("description") or "",
                                                                                encoding="utf-8")
    params = {"status": "published"} if p.get("live", True) else {}
    r = requests.put(f"{BASE}/api/products/{p['documentId']}", params=params,
                     json={"data": {"description": text}}, headers=headers(), timeout=60)
    if not r.ok:
        raise RuntimeError(f"Update failed {r.status_code}: {r.text[:500]}")
    return r.json()["data"].get("description", "")


def by_slug(slug: str) -> dict:
    for p in products():
        if p["slug"] == slug:
            return p
    sys.exit(f"No product with slug '{slug}'. Run `list` to see slugs.")


def gaps(p: dict) -> str:
    d = p.get("description") or ""
    if (p.get("category") or {}).get("name") != "Original Art":
        return "nbsp" if "&nbsp;" in d else ""
    missing = []
    if not re.search(r"^pictured\s*:", d, re.I | re.M):
        missing.append("pictured")
    if not re.search(r"frame", d, re.I):
        missing.append("framing")
    if not SPEC_YEAR.search(d):
        missing.append("year")
    if re.search(r"\d\s*[\"”]?\s*x\s*\d", d) or re.search(r"this is ", d, re.I):
        missing.append("messy-specs")
    return ",".join(missing)


def cmd_list() -> None:
    rows = products()
    print(f"{len(rows)} products ({'drafts included' if TOKEN else 'published only; no STRAPI_WRITE_TOKEN'})\n")
    for p in rows:
        cat = (p.get("category") or {}).get("name", "?")
        print(f"{p['slug']:45} {cat:13} {len(p.get('description') or ''):5}  {gaps(p)}")


def cmd_show(slug: str) -> None:
    p = by_slug(slug)
    print(f"TITLE: {p['title']}\nCATEGORY: {(p.get('category') or {}).get('name')}\nDOCUMENT: {p['documentId']}")
    print(f"PRICE: {p.get('price')}  SOLD: {p.get('sold')}  POSTER: {p.get('hasPoster')}")
    print("----- CURRENT DESCRIPTION -----")
    print(p.get("description") or "(empty)")
    print("----- END -----")
    print(f"LIVE: {p['live']}")
    photo = photo_path(p)
    print(f"PHOTO: {photo or 'none'}")


def cmd_update(slug: str, file: str) -> None:
    text = Path(file).read_text(encoding="utf-8")
    p = by_slug(slug)
    try:
        saved = update_description(p, text)
    except RuntimeError as e:
        sys.exit(str(e))
    what = "Saved and published." if p["live"] else "Saved (product is hidden, so it stays unpublished)."
    print(what if saved.strip() == text.strip() else "Saved, but the text came back different:\n" + saved)


def main() -> None:
    a = sys.argv[1:]
    if a[:1] == ["list"]:
        cmd_list()
    elif a[:1] == ["show"] and len(a) == 2:
        cmd_show(a[1])
    elif a[:1] == ["update"] and len(a) == 3:
        cmd_update(a[1], a[2])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
