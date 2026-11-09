"""
"Artist holding the poster" photos for any painting.

Templates are two studio photos of the same person holding a blank sheet: mockup/portrait_photo.png and
mockup/landscape_photo.png. `build` finds the sheet in each (and her fingers over it) and saves a mask and the
sheet's lighting; `make` prints the painting onto the sheet: the whole painting, centred with a thin paper
border, shaded by the room light, fingers kept on top.

    tools\\venv\\Scripts\\python tools\\etsy\\poster_mockup.py build                 # after changing a photo
    tools\\venv\\Scripts\\python tools\\etsy\\poster_mockup.py make SLUG [SLUG…]    # writes mockups_out/SLUG-poster.jpg
    tools\\venv\\Scripts\\python tools\\etsy\\poster_mockup.py missing             # posters with no poster photo in Strapi
    tools\\venv\\Scripts\\python tools\\etsy\\poster_mockup.py publish [SLUG…] [--replace-printful] [--redo] [--go]
        # add the studio photo to the products in Strapi (dry run unless --go); --replace-printful also
        # unlinks the old Printful "*poster*" photo (it stays in the Strapi media library); products that
        # already have a studio photo are skipped unless --redo (e.g. after the painting photo changed)
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
TPL = HERE / "mockup"            # photos + templates (committed)
OUT = HERE / "mockups_out"       # generated images (git-ignored)
STRAPI = "https://cms.tysondrawsstuff.com"
MARGIN = 0.035                   # paper border around the painting, as a share of the sheet's short side


# --------------------------------------------------------------------------- Strapi

def product(slug: str) -> dict | None:
    r = requests.get(STRAPI + "/api/products", timeout=60, params={
        "filters[slug][$eq]": slug, "populate[images][fields][0]": "name", "populate[images][fields][1]": "url"})
    data = r.json().get("data") if r.ok else None
    return data[0] if data else None


def fetch(url: str) -> Image.Image:
    url = url if url.startswith("http") else STRAPI + url
    return Image.open(io.BytesIO(requests.get(url, timeout=120).content))


def poster_photo(p: dict) -> dict | None:
    """An existing "poster" photo in Strapi (named *poster*), if the product has one."""
    return next((i for i in (p.get("images") or [])[1:] if "poster" in i["name"].lower()), None)


# --------------------------------------------------------------------------- templates

def whiteish(a: np.ndarray) -> np.ndarray:
    mx, mn = a.max(-1), a.min(-1)
    return (mn > 175) & ((mx - mn) < 40)


def find_sheet(white: np.ndarray) -> tuple[int, int, int, int]:
    """Bounding box of the blank sheet: the biggest region whose rows and columns are mostly white."""
    H, W = white.shape
    rows = np.where(white.mean(1) > 0.25)[0]
    cols = np.where(white.mean(0) > 0.25)[0]
    y0, y1, x0, x1 = rows[0], rows[-1], cols[0], cols[-1]
    # Tighten each edge to where the sheet really is (the window/lamp glare is white too).
    mid_r = slice((y0 + y1) // 2 - 40, (y0 + y1) // 2 + 40)
    band = white[y0:y1 + 1]
    col_frac = band.mean(0)
    xs = np.where(col_frac > 0.85)[0]
    x0, x1 = xs[0], xs[-1]
    row_frac = white[:, x0:x1 + 1].mean(1)
    ys = np.where(row_frac > 0.85)[0]
    y0, y1 = ys[0], ys[-1]
    del mid_r
    return int(x0), int(y0), int(x1 - x0 + 1), int(y1 - y0 + 1)


def smooth(x: np.ndarray, r: int = 20, passes: int = 3) -> np.ndarray:
    """Soft blur (repeated box filter ≈ Gaussian) for float arrays."""
    for _ in range(passes):
        for axis in (0, 1):
            c = np.cumsum(np.pad(x, [(r + 1, r) if i == axis else (0, 0) for i in range(2)], mode="edge"),
                          axis=axis)
            x = (np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis)
                 - np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)) / (2 * r + 1)
    return x


def build() -> None:
    meta = {}
    for kind in ("portrait", "landscape"):
        photo = Image.open(TPL / f"{kind}_photo.png").convert("RGB")
        a = np.asarray(photo).astype(float)
        white = whiteish(a)
        x0, y0, w, h = find_sheet(white)
        inrect = np.zeros(white.shape, bool)
        inrect[y0:y0 + h, x0:x0 + w] = True
        sheet = inrect & white
        m = Image.fromarray(sheet.astype(np.uint8) * 255)
        m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))   # fill paper-texture specks
        m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))   # drop specks on fingers
        m = m.filter(ImageFilter.MaxFilter(3))   # cover the pale blended pixels at the finger edges
        rect = Image.new("L", m.size, 0)
        rect.paste(255, (x0, y0, x0 + w, y0 + h))
        m = Image.fromarray(np.minimum(np.asarray(m), np.asarray(rect)))   # never past the sheet
        m = m.filter(ImageFilter.GaussianBlur(0.6))
        m.save(TPL / f"{kind}_mask.png")
        # Room light on the sheet: its brightness, smoothed, with the fingers filled in from around them.
        lum = a.mean(-1) * sheet
        num, den = smooth(lum), smooth(sheet.astype(float))
        shade = np.where(den > 0.05, num / np.maximum(den, 1e-3), 235.0) / 240.0
        shade = np.clip(shade, 0.7, 1.04)
        Image.fromarray(np.clip(shade * 200, 0, 255).astype(np.uint8)).save(TPL / f"{kind}_shade.png")
        meta[kind] = [x0, y0, w, h]
        print(f"{kind}: sheet at x={x0} y={y0} {w}x{h} (ratio {w / h:.3f})")
    (TPL / "templates.json").write_text(json.dumps(meta, indent=2))


# --------------------------------------------------------------------------- making one

def make(art: Image.Image) -> Image.Image:
    meta = json.loads((TPL / "templates.json").read_text())
    art = art.convert("RGB")
    kind = "landscape" if art.width > art.height * 1.05 else "portrait"
    x0, y0, w, h = meta[kind]
    photo = Image.open(TPL / f"{kind}_photo.png").convert("RGB")
    mask = Image.open(TPL / f"{kind}_mask.png").convert("L")
    shade = np.asarray(Image.open(TPL / f"{kind}_shade.png").convert("L")).astype(float) / 200.0

    # Paper: the sheet as photographed. Painting: whole, centred, inside a thin border.
    pad = round(min(w, h) * MARGIN)
    bw, bh = w - 2 * pad, h - 2 * pad
    s = min(bw / art.width, bh / art.height)
    pw, ph = round(art.width * s), round(art.height * s)
    painted = np.asarray(photo).astype(float).copy()
    px, py = x0 + (w - pw) // 2, y0 + (h - ph) // 2
    a = np.asarray(art.resize((pw, ph), Image.LANCZOS)).astype(float)
    painted[py:py + ph, px:px + pw] = a * shade[py:py + ph, px:px + pw, None]
    painted = Image.fromarray(np.clip(painted, 0, 255).astype(np.uint8))
    return Image.composite(painted, photo, mask)


def make_for(slug: str) -> Path | None:
    p = product(slug)
    if not p or not p.get("images"):
        return None
    OUT.mkdir(exist_ok=True)
    out = OUT / f"{slug}-poster.jpg"
    make(fetch(p["images"][0]["url"])).save(out, "JPEG", quality=90)
    return out


def missing() -> list[str]:
    r = requests.get(STRAPI + "/api/products", timeout=60, params={
        "filters[hasPoster][$eq]": "true", "pagination[limit]": 200,
        "populate[images][fields][0]": "name", "populate[images][fields][1]": "url"})
    return [p["slug"] for p in r.json()["data"] if not poster_photo(p)]


STUDIO_TAG = "studio-poster"  # in the uploaded file name, so reruns can find (and replace) our own photo


def publish(slugs: list[str], replace_printful: bool, dry: bool, redo: bool = False) -> None:
    """Upload the studio photo to each poster product in Strapi (added after its other photos).
    Needs STRAPI_WRITE_TOKEN with Upload > upload, plus Product find/update."""
    sys.path.insert(0, str(HERE.parent / "describe"))
    import strapi_desc as sd  # token + Strapi URL from .env.railway
    hdr = sd.headers()
    params = {"filters[hasPoster][$eq]": "true", "pagination[limit]": 200, "status": "draft",
              "populate[images][fields][0]": "name", "populate[images][fields][1]": "url"}
    r = requests.get(sd.BASE + "/api/products", params=params, headers=hdr, timeout=60)
    r.raise_for_status()
    live = {p["documentId"] for p in requests.get(sd.BASE + "/api/products", headers=hdr, timeout=60, params={
        **params, "status": "published"}).json()["data"]}
    for p in r.json()["data"]:
        if slugs and p["slug"] not in slugs:
            continue
        imgs = p.get("images") or []
        if not imgs or (not redo and any(STUDIO_TAG in i["name"] for i in imgs)):
            continue
        keep = [i for i in imgs if STUDIO_TAG not in i["name"]
                and not (replace_printful and i is not imgs[0] and "poster" in i["name"].lower())]
        dropped = [i["name"] for i in imgs if i not in keep]
        print(f"{p['slug']}: +studio photo" + (f", removing {', '.join(dropped)}" if dropped else ""))
        if dry:
            continue
        buf = io.BytesIO()
        make(fetch(imgs[0]["url"])).save(buf, "JPEG", quality=90)
        name = p["title"].replace(" - Original Art", "").strip()
        up = requests.post(sd.BASE + "/api/upload", headers=hdr, timeout=180,
                           files={"files": (f"{p['slug']}-{STUDIO_TAG}.jpg", buf.getvalue(), "image/jpeg")},
                           data={"fileInfo": json.dumps({"alternativeText":
                                 f"{name} poster print, held up in an art studio"})})
        if not up.ok:
            sys.exit(f"Upload failed {up.status_code}: {up.text[:300]}")
        new_id = up.json()[0]["id"]
        q = {"status": "published"} if p["documentId"] in live else {}
        u = requests.put(f"{sd.BASE}/api/products/{p['documentId']}", params=q, headers=hdr, timeout=60,
                         json={"data": {"images": [i["id"] for i in keep] + [new_id]}})
        if not u.ok:
            sys.exit(f"Product update failed {u.status_code}: {u.text[:300]}")


def main() -> None:
    a = sys.argv[1:]
    if a[:1] == ["publish"]:
        flags = {x for x in a[1:] if x.startswith("--")}
        publish([x for x in a[1:] if not x.startswith("--")], "--replace-printful" in flags,
                dry="--go" not in flags, redo="--redo" in flags)
        if "--go" not in flags:
            print("\nDry run. Add --go to upload.")
        return
    if a[:1] == ["build"]:
        build()
    elif a[:1] == ["make"] and len(a) > 1:
        for slug in a[1:]:
            print(slug, "->", make_for(slug) or "no product/photo")
    elif a[:1] == ["missing"]:
        print("\n".join(missing()))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
