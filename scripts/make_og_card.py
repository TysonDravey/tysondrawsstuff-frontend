"""Build the 1200x630 link-preview card: framed pieces hung on the oxblood wall, wordmark below.
usage: python og_card.py FRONTEND_DIR OUT.jpg"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

root = Path(sys.argv[1]); out = sys.argv[2]
W, H = 1200, 630

# Wall: oxblood, lighter up top-left (the picture lights), fine noise, darker at the floor.
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
base = np.array([74, 20, 24], np.float32)
light = 1.0 + 0.22 * np.exp(-(((xx - W * .35) / 700) ** 2 + ((yy - 40) / 420) ** 2)) - 0.30 * (yy / H) ** 2
wall = base[None, None, :] * light[..., None]
wall += np.random.default_rng(7).normal(0, 3.2, (H, W, 1))
card = Image.fromarray(np.clip(wall, 0, 255).astype(np.uint8)).convert("RGBA")

def glow(cx, top, w):
    """Warm picture-light pool on the wall above a painting."""
    g = Image.new("L", (W, H), 0)
    a = np.exp(-(((xx - cx) / (w * .75)) ** 2 + ((yy - top + 10) / 170) ** 2)) * 70
    g = Image.fromarray(a.astype(np.uint8))
    tint = Image.new("RGBA", (W, H), (255, 190, 120, 0)); tint.putalpha(g)
    card.alpha_composite(tint)

def hang(name, cx, top, h, tilt):
    im = Image.open(root / "public/framed" / name).convert("RGBA")
    im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS).rotate(tilt, Image.BICUBIC, expand=True)
    glow(cx, top, im.width)
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sh.putalpha(im.getchannel("A").point(lambda v: v * .6))
    pad = 40
    shadow = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    shadow.alpha_composite(sh, (pad, pad)); shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    x = round(cx - im.width / 2)
    card.alpha_composite(shadow, (x - pad + 10, top - pad + 16))
    card.alpha_composite(im, (x, top))

hang("fire_frame_02.webp", 240, 52, 380, 1.2)
hang("TDS_selfportrait_2026_01.webp", 600, 34, 410, -0.6)
hang("water_frame_02.webp", 960, 58, 372, -1.4)

wm = Image.open(root / "public/brand/tds-wordmark-dark.png").convert("RGBA")
ww = 760; wm = wm.resize((ww, round(wm.height * ww / wm.width)), Image.LANCZOS)
card.alpha_composite(wm, ((W - ww) // 2, 560 - wm.height // 2 + 4))

card.convert("RGB").save(out, quality=88, optimize=True, progressive=True)
print(out, Path(out).stat().st_size // 1024, "KB")
