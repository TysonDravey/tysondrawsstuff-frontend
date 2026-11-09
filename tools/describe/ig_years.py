"""
Guess roughly when each painting was made, from your Instagram data download.

1. Instagram > Settings > Accounts Center > Your information and permissions > Download your information
   > Download or transfer information > your IG account > Some of your information > Content (Posts)
   > Download to device > Date range: All time, Format: JSON, Media quality: Low > Create files.
2. When the email arrives, download the zip (leave it zipped).
3. Run:   tools\\venv\\Scripts\\python tools\\describe\\ig_years.py  [path\\to\\instagram-....zip]
   (no path = newest instagram*.zip in your Downloads folder)

It compares each product's main photo with every photo you've posted (a small "fingerprint" of each picture,
so crops and colour edits still match), and writes ig_hints.json: the date each painting FIRST showed up on
your Instagram, plus the caption. The description window shows this as a hint; you still type the year.
"""
from __future__ import annotations

import io
import json
import sys
import zipfile
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import strapi_desc as sd  # noqa: E402

OUT = HERE / "ig_hints.json"
SIDE = 16                    # 16x16 difference hash = 256 bits
MATCH = int(SIDE * SIDE * 0.30)  # at most 30% of bits different = same picture (unrelated ones are ~40%+)


def dhash(im: Image.Image) -> int:
    g = ImageOps.exif_transpose(im).convert("RGB").convert("L").resize((SIDE + 1, SIDE), Image.LANCZOS)
    px = g.load()
    bits = 0
    for y in range(SIDE):
        for x in range(SIDE):
            bits = (bits << 1) | (px[x, y] > px[x + 1, y])
    return bits


def crops(im: Image.Image) -> list[Image.Image]:
    """The photo plus centre crops at Instagram's usual shapes (square, 4:5 portrait, 1.91:1 landscape)."""
    im = ImageOps.exif_transpose(im)
    w, h = im.size
    out = [im]
    for ratio in (1.0, 4 / 5, 1.91):
        if w / h > ratio:
            nw = int(h * ratio)
            out.append(im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h)))
        else:
            nh = int(w / ratio)
            out.append(im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh)))
    return out


def fix_text(t: str) -> str:
    """Instagram exports store UTF-8 as latin-1 escapes ("Ã©" for "é")."""
    try:
        return t.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return t


def find_zip() -> Path:
    if len(sys.argv) > 1:
        return Path(sys.argv[1])
    zips = sorted((Path.home() / "Downloads").glob("instagram*.zip"), key=lambda p: p.stat().st_mtime)
    if not zips:
        sys.exit("No instagram*.zip in Downloads. Pass the path: ig_years.py C:\\path\\to\\export.zip")
    return zips[-1]


def ig_posts(z: zipfile.ZipFile) -> list[dict]:
    """[{uri, ts, caption}] for every photo in every post (and story, if included)."""
    out = []
    for name in z.namelist():
        base = name.rsplit("/", 1)[-1]
        if not (base.startswith("posts_") or base in ("stories.json", "archived_posts.json")) \
                or not base.endswith(".json"):
            continue
        data = json.loads(z.read(name))
        if isinstance(data, dict):  # some formats wrap the list
            data = next((v for v in data.values() if isinstance(v, list)), [])
        for post in data:
            media = post.get("media") or [post]
            cap = post.get("title") or (media[0].get("title") if media else "") or ""
            ts = post.get("creation_timestamp") or (media[0].get("creation_timestamp") if media else 0)
            for m in media:
                uri = m.get("uri", "")
                if uri.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic")):
                    out.append({"uri": uri, "ts": m.get("creation_timestamp") or ts, "caption": fix_text(cap)})
    return out


def open_member(z: zipfile.ZipFile, uri: str) -> Image.Image | None:
    names = [uri, uri.lstrip("/")]
    names += [n for n in z.namelist() if n.endswith("/" + uri.lstrip("/"))]
    for n in names:
        try:
            return Image.open(io.BytesIO(z.read(n)))
        except (KeyError, OSError):
            continue
    return None


def main() -> None:
    zpath = find_zip()
    print(f"Instagram export: {zpath}")
    z = zipfile.ZipFile(zpath)
    posts = ig_posts(z)
    if not posts:
        sys.exit("Found no posts in that zip. Was it the JSON format with Content > Posts ticked?")
    print(f"{len(posts)} photos in your posts. Fingerprinting…")
    ig = []
    for i, p in enumerate(posts, 1):
        im = open_member(z, p["uri"])
        if im is not None:
            try:
                ig.append({**p, "hash": dhash(im)})
            except OSError:
                pass
        if i % 200 == 0:
            print(f"  {i}/{len(posts)}")

    print("Fingerprinting product photos…")
    hints = {}
    for prod in sd.products():
        path = sd.photo_path(prod)
        if not path:
            continue
        try:
            hs = [dhash(c) for c in crops(Image.open(path))]
        except OSError:
            continue
        matches = []
        for p in ig:
            d = min(bin(h ^ p["hash"]).count("1") for h in hs)
            if d <= MATCH:
                matches.append((p["ts"], d, p))
        if not matches:
            continue
        matches.sort(key=lambda m: m[0])
        first = matches[0]
        best = min(matches, key=lambda m: m[1])
        hints[prod["slug"]] = {
            "date": datetime.fromtimestamp(first[0]).strftime("%Y-%m-%d"),
            "caption": first[2]["caption"][:200],
            "score": f"{100 - round(100 * best[1] / (SIDE * SIDE))}%",
            "posts": len(matches),
        }
        print(f"  {prod['slug']:45} {hints[prod['slug']]['date']}  ({len(matches)} posts)")

    OUT.write_text(json.dumps(hints, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nMatched {len(hints)} products. Wrote {OUT.name}; reopen (or Reload) the description window.")


if __name__ == "__main__":
    main()
