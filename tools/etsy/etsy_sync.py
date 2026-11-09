"""
Etsy listing sync for Tyson Draws Stuff: poster prints and books from the site's product feed
become DRAFT listings in the Etsy shop (nothing goes live until it's published in Etsy).

Keys come from frontend/.env.railway (ETSY_KEYSTRING, ETSY_SHARED_SECRET). Run with the tools venv:

    tools\\venv\\Scripts\\python tools\\etsy\\etsy_sync.py auth     # once: approve the app in the browser
    tools\\venv\\Scripts\\python tools\\etsy\\etsy_sync.py setup    # once: pick shipping/returns/processing/category
    tools\\venv\\Scripts\\python tools\\etsy\\etsy_sync.py plan     # dry run: show what would be listed
    tools\\venv\\Scripts\\python tools\\etsy\\etsy_sync.py push --limit 2   # create a couple of drafts to check
    tools\\venv\\Scripts\\python tools\\etsy\\etsy_sync.py push     # create the rest
    tools\venv\Scripts\python tools\etsy\etsy_sync.py report   # views / favourites / sales / expiry

Why localhost: Etsy's sign-in (OAuth) ends by sending the browser to a "callback" address with a one-time
code. This script listens on http://localhost:3003/callback for a few seconds to catch that code and swap
it for tokens. Nothing is hosted anywhere; the tokens stay in tools/etsy/.etsy-tokens.json on this PC.

Files:
  etsy_config.json      choices from `setup` + poster details + pricing (safe to commit)
  etsy_listings.json    feed id -> Etsy listing id, so a run never lists the same thing twice (safe to commit)
  .etsy-tokens.json     OAuth tokens (git-ignored; never commit)
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import math
import re
import secrets
import sys
import threading
import time
import urllib.parse
import webbrowser
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parent.parent
ENV_FILE = FRONTEND / ".env.railway"
CONFIG_FILE = HERE / "etsy_config.json"
STATE_FILE = HERE / "etsy_listings.json"
TOKEN_FILE = HERE / ".etsy-tokens.json"

FEED_URL = "https://www.tysondrawsstuff.com/meta-feed.xml"
API = "https://openapi.etsy.com/v3/application"
TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token"
CONNECT_URL = "https://www.etsy.com/oauth/connect"
REDIRECT_URI = "http://localhost:3003/callback"
SCOPES = "listings_r listings_w shops_r shops_w transactions_r"  # transactions_r: sales counts for `report`
G = "{http://base.google.com/ns/1.0}"

DEFAULT_CONFIG = {
    "markup": 1.10,  # Etsy price = site price x markup, rounded up to the next whole dollar
    "quantity": {"poster": 10, "book": 5},
    # Fill in before pushing posters, e.g. "12 x 18 inch print on heavy matte paper, shipped rolled in a tube."
    "poster_details": "",
    "poster_size": "",  # short, for titles, e.g. "12x18"
    # Etsy's "when made" bucket. If Etsy rejects it, the error lists the allowed values.
    "when_made": "2020_2026",
    "shipping_profile_id": None,
    "return_policy_id": None,
    "readiness_state_id": None,
    "taxonomy_id": {"poster": None, "book": None},
    # Trial run: listings expire after 4 months instead of renewing ($0.20 each). Check `report` first.
    "auto_renew": False,
    # Feed ids never to list on Etsy: fan art of other people's characters (Etsy pulls these on IP complaints).
    "exclude": [],
    "base_tags": ["art print", "wall art", "poster", "illustration", "tyson draws stuff", "canadian artist",
                  "horror art", "gift for him", "gift for her", "home decor", "art lover gift"],
}


# --------------------------------------------------------------------------- basics

def env() -> dict:
    vals = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$", line)
        if m:
            vals[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    for k in ("ETSY_KEYSTRING", "ETSY_SHARED_SECRET"):
        if not vals.get(k):
            sys.exit(f"{k} is missing from {ENV_FILE}")
    return vals


def load(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def save(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def config() -> dict:
    cfg = {**DEFAULT_CONFIG, **load(CONFIG_FILE, {})}
    save(CONFIG_FILE, cfg)  # writes defaults the first time, so there's a file to edit
    return cfg


# --------------------------------------------------------------------------- auth

def api_key_header(e: dict) -> str:
    # Etsy wants "keystring:shared_secret" in x-api-key.
    return f"{e['ETSY_KEYSTRING']}:{e['ETSY_SHARED_SECRET']}"


def cmd_auth(_args) -> None:
    e = env()
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(48)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    url = CONNECT_URL + "?" + urllib.parse.urlencode({
        "response_type": "code", "redirect_uri": REDIRECT_URI, "scope": SCOPES,
        "client_id": e["ETSY_KEYSTRING"], "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256",
    })
    got: dict = {}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            got.update({k: v[0] for k, v in q.items()})
            ok = "code" in got and got.get("state") == state
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            msg = "Etsy connected. You can close this tab." if ok else f"Etsy sign-in failed: {html.escape(str(got))}"
            self.wfile.write(f"<p style='font:18px sans-serif'>{msg}</p>".encode())

        def log_message(self, *a):
            pass

    server = HTTPServer(("localhost", 3003), Handler)
    threading.Thread(target=server.handle_request, daemon=True).start()
    print("Opening Etsy in your browser. Click Allow.\nIf it doesn't open, visit:\n" + url)
    webbrowser.open(url)
    for _ in range(300):
        if got:
            break
        time.sleep(1)
    server.server_close()
    if got.get("state") != state or "code" not in got:
        sys.exit(f"No approval received: {got or 'timed out'}")
    r = requests.post(TOKEN_URL, data={
        "grant_type": "authorization_code", "client_id": e["ETSY_KEYSTRING"],
        "redirect_uri": REDIRECT_URI, "code": got["code"], "code_verifier": verifier,
    }, timeout=30)
    r.raise_for_status()
    tok = r.json()
    tok["obtained_at"] = int(time.time())
    save(TOKEN_FILE, tok)
    print("Connected. Tokens saved to", TOKEN_FILE.name)


class Etsy:
    def __init__(self):
        self.e = env()
        self.tok = load(TOKEN_FILE, None)
        if not self.tok:
            sys.exit("Not connected yet: run `etsy_sync.py auth` first.")
        self.user_id = int(self.tok["access_token"].split(".")[0])
        self._shop_id = None

    def _refresh_if_needed(self):
        if time.time() < self.tok["obtained_at"] + self.tok.get("expires_in", 3600) - 120:
            return
        r = requests.post(TOKEN_URL, data={
            "grant_type": "refresh_token", "client_id": self.e["ETSY_KEYSTRING"],
            "refresh_token": self.tok["refresh_token"],
        }, timeout=30)
        r.raise_for_status()
        self.tok = {**r.json(), "obtained_at": int(time.time())}
        save(TOKEN_FILE, self.tok)

    def req(self, method: str, path: str, **kw):
        self._refresh_if_needed()
        headers = {"x-api-key": api_key_header(self.e), "Authorization": f"Bearer {self.tok['access_token']}"}
        r = requests.request(method, API + path, headers=headers, timeout=60, **kw)
        if r.status_code == 429:
            time.sleep(2)
            return self.req(method, path, **kw)
        if not r.ok:
            raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:600]}")
        return r.json() if r.content else {}

    @property
    def shop_id(self) -> int:
        if self._shop_id is None:
            me = self.req("GET", "/users/me")
            self._shop_id = me.get("shop_id") or self.req("GET", f"/users/{self.user_id}/shops")["shop_id"]
        return self._shop_id


# --------------------------------------------------------------------------- setup

def pick(label: str, rows: list, show) -> int | None:
    if not rows:
        print(f"\nNo {label} found in the shop. Create one in Etsy (Settings), then run setup again.")
        return None
    print(f"\n{label}:")
    for i, row in enumerate(rows, 1):
        print(f"  {i}. {show(row)}")
    while True:
        a = input(f"Choose 1-{len(rows)} (Enter = 1): ").strip() or "1"
        if a.isdigit() and 1 <= int(a) <= len(rows):
            return rows[int(a) - 1]
        print("  ?")


def find_taxonomy(etsy: Etsy, words: list[str]) -> list[dict]:
    nodes = etsy.req("GET", "/seller-taxonomy/nodes")["results"]
    flat = []

    def walk(ns, trail):
        for n in ns:
            path = trail + [n["name"]]
            flat.append({"id": n["id"], "path": " > ".join(path)})
            walk(n.get("children") or [], path)

    walk(nodes, [])
    return [n for n in flat if all(w.lower() in n["path"].lower() for w in words)][:12]


def cmd_setup(_args) -> None:
    etsy, cfg = Etsy(), config()
    sid = etsy.shop_id
    print("Shop id:", sid)
    ship = etsy.req("GET", f"/shops/{sid}/shipping-profiles")["results"]
    p = pick("Shipping profile (use one that's free shipping within Canada)", ship,
             lambda s: f"{s['title']} (id {s['shipping_profile_id']})")
    cfg["shipping_profile_id"] = p and p["shipping_profile_id"]
    rets = etsy.req("GET", f"/shops/{sid}/policies/return")["results"]
    p = pick("Return policy", rets, lambda r: f"returns {r.get('accepts_returns')}, exchanges "
             f"{r.get('accepts_exchanges')}, {r.get('return_deadline')} days (id {r['return_policy_id']})")
    cfg["return_policy_id"] = p and p["return_policy_id"]
    try:
        ready = etsy.req("GET", f"/shops/{sid}/readiness-state-definitions")["results"]
        p = pick("Processing time", ready, lambda r: f"{r.get('readiness_state')} "
                 f"{r.get('min_processing_time')}-{r.get('max_processing_time')} {r.get('processing_time_unit')} "
                 f"(id {r['readiness_state_definition_id']})")
        cfg["readiness_state_id"] = p and p["readiness_state_definition_id"]
    except RuntimeError as err:
        print("Processing profiles not available:", err)
    for kind, words in (("poster", ["Prints"]), ("book", ["Books"])):
        p = pick(f"Etsy category for {kind}s", find_taxonomy(etsy, words), lambda n: f"{n['path']} (id {n['id']})")
        cfg["taxonomy_id"][kind] = p and p["id"]
    save(CONFIG_FILE, cfg)
    print("\nSaved to", CONFIG_FILE.name)
    if not cfg["poster_details"]:
        print("Still to do: fill in poster_details and poster_size in", CONFIG_FILE.name)


# --------------------------------------------------------------------------- listings

def feed_items(cfg: dict) -> list[dict]:
    root = ET.fromstring(requests.get(FEED_URL, timeout=60).content)
    out = []
    for it in root.iter("item"):
        g = lambda t: (it.findtext(G + t) or "").strip()  # noqa: E731
        ptype = g("product_type")
        kind = "poster" if ptype == "Poster print" else "book" if ptype == "Books" else None
        if not kind:
            continue
        price = float(g("price").split()[0])
        out.append({
            "id": g("id"), "kind": kind, "link": g("link"), "price": price,
            "etsy_price": math.ceil(price * cfg["markup"]),
            "name": re.sub(r"\s*-?\s*Original Art$", "",
                           re.sub(r":\s*poster print by Tyson Draws Stuff$", "", g("title")), flags=re.I).strip(),
            "description": g("description"),
        })
    return out


def page_image(link: str) -> str | None:
    """The product page's main photo (what Instagram/Facebook show), larger than the feed copy."""
    page = requests.get(link.split("#")[0], timeout=60).text
    m = re.search(r'<meta property="og:image" content="([^"]+)"', page)
    return html.unescape(m.group(1)) if m else None


def tag_list(item: dict, cfg: dict) -> list[str]:
    name = item["name"].lower()
    own = [name] if len(name) <= 20 else []
    filler = {"real", "tyson", "draws", "stuff", "with", "from", "that", "this", "kirk", "brillon", "years"}
    words = [] if item["kind"] == "book" else [w for w in re.findall(r"[a-z]+", name) if len(w) > 3 and w not in filler]
    if item["kind"] == "book":
        base = ["art book", "artist book", "illustration book", "tyson draws stuff", "canadian artist",
                "horror art", "coffee table book", "gift for artist", "sketchbook art"]
    else:
        base = cfg["base_tags"]
    tags = []
    for t in own + [f"{w} art" for w in words[:2]] + base:
        t = t[:20].strip()
        if t and t not in tags:
            tags.append(t)
    return tags[:13]


def listing_body(item: dict, cfg: dict) -> dict:
    if item["kind"] == "poster":
        size = f" {cfg['poster_size']}" if cfg["poster_size"] else ""
        title = f"{item['name']} Poster Print{size} | Art Print by Tyson Draws Stuff"
        story = re.sub(r"^Poster print of .*?\(Kirk Brillon\)\.\s*", "", item["description"])
        desc = (f"Poster print of “{item['name']}”, an original painting by Kirk Brillon (Tyson Draws Stuff).\n\n"
                f"{cfg['poster_details']}\n\nAbout the original: {story}\n\nFree shipping within Canada.")
    else:
        by = "" if "tyson draws stuff" in item["name"].lower() else " by Tyson Draws Stuff"
        title = f"{item['name']} | Art Book{by}"
        desc = f"{item['description']}\n\nFree shipping within Canada."
    body = {
        "quantity": cfg["quantity"][item["kind"]],
        "title": title[:140],
        "description": desc.strip(),
        "price": item["etsy_price"],
        "who_made": "i_did",
        "when_made": cfg["when_made"],
        "taxonomy_id": cfg["taxonomy_id"][item["kind"]],
        "shipping_profile_id": cfg["shipping_profile_id"],
        "return_policy_id": cfg["return_policy_id"],
        "type": "physical",
        "is_supply": False,
        "should_auto_renew": bool(cfg.get("auto_renew")),
        "tags": tag_list(item, cfg),
    }
    if cfg.get("readiness_state_id"):
        body["readiness_state_id"] = cfg["readiness_state_id"]
    return body


def ready_problems(cfg: dict, items: list[dict]) -> list[str]:
    probs = []
    for k in ("shipping_profile_id", "return_policy_id"):
        if not cfg.get(k):
            probs.append(f"{k} not set (run setup)")
    for kind in {i["kind"] for i in items}:
        if not cfg["taxonomy_id"].get(kind):
            probs.append(f"taxonomy for {kind} not set (run setup)")
    if any(i["kind"] == "poster" for i in items) and not cfg["poster_details"]:
        probs.append(f"poster_details is empty in {CONFIG_FILE.name}")
    return probs


def cmd_plan(args) -> None:
    cfg, state = config(), load(STATE_FILE, {})
    items = [i for i in feed_items(cfg) if i["id"] not in state and i["id"] not in cfg["exclude"]]
    print(f"{len(items)} to list ({len(state)} already on Etsy)\n")
    for i in items[: args.limit or len(items)]:
        b = listing_body(i, cfg)
        print(f"- [{i['kind']}] ${i['price']:.0f} site -> ${b['price']} Etsy | {b['title']}")
        if args.verbose:
            print("    tags:", ", ".join(b["tags"]))
            print("    " + b["description"].replace("\n", "\n    "))
    for p in ready_problems(cfg, items):
        print("NOT READY:", p)


STRAPI = "https://cms.tysondrawsstuff.com"
# Extra Strapi photos worth showing on Etsy: the poster held up, and room/wall mock-ups. Photos of the framed
# original are left out (the poster doesn't come framed).
EXTRA_PHOTO = re.compile(r"poster|wall|nook|interior|room|study|cozy|marketing", re.I)


def extra_images(item: dict) -> list[str]:
    """URLs of the product's extra Strapi photos for Etsy, the poster-in-hand shot first."""
    slug = re.sub(r"-poster$", "", item["id"])
    r = requests.get(STRAPI + "/api/products", timeout=60, params={
        "filters[slug][$eq]": slug, "populate[images][fields][0]": "name", "populate[images][fields][1]": "url"})
    data = r.json().get("data") if r.ok else None
    if not data:
        return []
    imgs = (data[0].get("images") or [])[1:]  # [0] is the main artwork, already uploaded
    if item["kind"] == "poster":
        imgs = [i for i in imgs if EXTRA_PHOTO.search(i["name"])]
        imgs.sort(key=lambda i: 0 if "poster" in i["name"].lower() else 1)
    return [(u if u.startswith("http") else STRAPI + u) for u in (i["url"] for i in imgs)][:9]


def as_jpeg(url: str) -> bytes:
    """Download and re-save as a reasonably sized JPEG (Strapi mock-ups are multi-MB PNGs)."""
    from io import BytesIO
    from PIL import Image
    im = Image.open(BytesIO(requests.get(url, timeout=120).content)).convert("RGB")
    im.thumbnail((2000, 2000))
    out = BytesIO()
    im.save(out, "JPEG", quality=88)
    return out.getvalue()


def upload_extras(etsy: "Etsy", sid: int, lid: int, item: dict, start_rank: int) -> int:
    n = 0
    for n, url in enumerate(extra_images(item), 1):
        etsy.req("POST", f"/shops/{sid}/listings/{lid}/images",
                 files={"image": (f"{item['id']}-{n}.jpg", as_jpeg(url), "image/jpeg")},
                 data={"rank": start_rank + n - 1})
    return n


def cmd_push(args) -> None:
    cfg, state = config(), load(STATE_FILE, {})
    items = [i for i in feed_items(cfg) if i["id"] not in state and i["id"] not in cfg["exclude"]]
    items = items[: args.limit or None]
    probs = ready_problems(cfg, items)
    if probs:
        sys.exit("Not ready:\n  " + "\n  ".join(probs))
    etsy = Etsy()
    sid = etsy.shop_id
    for n, item in enumerate(items, 1):
        print(f"[{n}/{len(items)}] {item['name']} ({item['kind']})", flush=True)
        listing = etsy.req("POST", f"/shops/{sid}/listings", json=listing_body(item, cfg))
        lid = listing["listing_id"]
        state[item["id"]] = {"listing_id": lid, "created": time.strftime("%Y-%m-%d")}
        save(STATE_FILE, state)  # saved per listing, so a failure part way never causes duplicates
        img = page_image(item["link"])
        if img:
            data = requests.get(img, timeout=60).content
            etsy.req("POST", f"/shops/{sid}/listings/{lid}/images",
                     files={"image": (f"{item['id']}.jpg", data, "image/jpeg")}, data={"rank": 1})
        else:
            print("   (no photo found; add one in Etsy)")
        extra = upload_extras(etsy, sid, lid, item, start_rank=2)
        if extra:
            print(f"   + {extra} more photo(s)")
        print(f"   draft: https://www.etsy.com/your/shops/me/listing-editor/edit/{lid}")
    print("\nDone. Drafts are in Etsy > Shop Manager > Listings > Drafts. Publish them there.")


def cmd_images(_args) -> None:
    """Add the extra photos to listings this script already made that still have only one photo."""
    cfg, state, etsy = config(), load(STATE_FILE, {}), Etsy()
    sid = etsy.shop_id
    items = {i["id"]: i for i in feed_items(cfg)}
    for fid, rec in state.items():
        item = items.get(fid)
        if not item:
            continue
        have = etsy.req("GET", f"/listings/{rec['listing_id']}/images")["count"]
        if have > 1:
            continue
        n = upload_extras(etsy, sid, rec["listing_id"], item, start_rank=have + 1)
        print(f"{item['name']}: +{n} photo(s)")


def cmd_report(_args) -> None:
    """Views, favourites, sales and expiry for every listing this script made: the renew-or-drop check."""
    etsy, state = Etsy(), load(STATE_FILE, {})
    if not state:
        sys.exit("Nothing listed yet.")
    sid = etsy.shop_id
    sold: dict[int, int] = {}
    offset = 0
    while True:  # every sale in the shop, counted per listing
        page = etsy.req("GET", f"/shops/{sid}/transactions", params={"limit": 100, "offset": offset})
        for t in page["results"]:
            sold[t["listing_id"]] = sold.get(t["listing_id"], 0) + t.get("quantity", 1)
        offset += 100
        if offset >= page["count"]:
            break
    rows = []
    for fid, rec in state.items():
        try:
            l = etsy.req("GET", f"/listings/{rec['listing_id']}")
        except RuntimeError:
            rows.append((fid, "gone", 0, 0, 0, ""))
            continue
        ends = time.strftime("%Y-%m-%d", time.localtime(l["ending_timestamp"])) if l.get("ending_timestamp") else ""
        rows.append((fid, l["state"], l.get("views") or 0, l.get("num_favorers") or 0,
                     sold.get(rec["listing_id"], 0), ends))
    rows.sort(key=lambda r: (-r[4], -r[3], -r[2]))
    print(f"{'listing':42} {'state':9} {'views':>6} {'favs':>5} {'sold':>5}  ends")
    for fid, st, v, f, n, ends in rows:
        print(f"{fid[:42]:42} {st:9} {v:>6} {f:>5} {n:>5}  {ends}")
    print(f"\nTotal: {sum(r[2] for r in rows)} views, {sum(r[3] for r in rows)} favourites, {sum(r[4] for r in rows)} sold")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("auth").set_defaults(fn=cmd_auth)
    sub.add_parser("setup").set_defaults(fn=cmd_setup)
    sub.add_parser("report").set_defaults(fn=cmd_report)
    sub.add_parser("images").set_defaults(fn=cmd_images)
    p = sub.add_parser("plan")
    p.add_argument("--limit", type=int)
    p.add_argument("-v", "--verbose", action="store_true")
    p.set_defaults(fn=cmd_plan)
    p = sub.add_parser("push")
    p.add_argument("--limit", type=int)
    p.set_defaults(fn=cmd_push)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
