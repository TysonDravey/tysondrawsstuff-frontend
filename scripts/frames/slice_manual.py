"""Cut frames from a sheet using rough hand-marked boxes, snapping each edge to the strongest
nearby edge in the image. Writes frame-NN.webp + frames.json (+ _contact.jpg preview).

usage: python slice_manual.py SHEET OUT_DIR
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sheet, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
im = Image.open(sheet).convert("RGB")
g = np.array(im.convert("L"), dtype=np.float32)
gx = np.abs(np.diff(g, axis=1, prepend=g[:, :1]))  # vertical edges
gy = np.abs(np.diff(g, axis=0, prepend=g[:1, :]))  # horizontal edges

# name, outer box (x0, y0, x1, y1), opening box — rough, by eye
F = [
    ("thin-black",      (385, 60, 592, 262),    (397, 73, 580, 250)),
    ("black-gold-leaf", (614, 35, 912, 287),    (657, 80, 870, 242)),
    ("cream-distressed",(933, 27, 1224, 292),   (998, 95, 1160, 228)),
    ("red-gold-corner", (1246, 45, 1517, 273),  (1286, 85, 1478, 235)),
    ("stars-moons",     (25, 316, 318, 543),    (80, 362, 268, 494)),
    ("burl",            (336, 309, 618, 547),   (393, 366, 561, 492)),
    ("thin-gold",       (640, 327, 895, 533),   (655, 342, 880, 518)),
    ("green-gold",      (918, 316, 1199, 544),  (962, 357, 1158, 503)),
    ("black-wide",      (1222, 312, 1517, 546), (1270, 358, 1470, 497)),
    ("white-chippy",    (27, 573, 290, 760),    (50, 596, 268, 738)),
    ("black-double",    (317, 562, 606, 778),   (375, 618, 549, 723)),
    ("gold-floral",     (625, 568, 901, 771),   (663, 605, 865, 733)),
    ("cream-wide",      (924, 566, 1212, 772),  (966, 610, 1167, 726)),
    ("black-vine",      (1237, 580, 1512, 763), (1260, 604, 1488, 738)),
    ("rust-studs",      (20, 786, 310, 1001),   (72, 838, 262, 950)),
    ("gold-rope",       (336, 800, 592, 998),   (362, 826, 567, 970)),
    ("red-chippy",      (615, 791, 910, 1005),  (655, 833, 870, 962)),
    ("driftwood",       (931, 798, 1202, 1001), (963, 832, 1170, 970)),
    ("gold-beaded",     (1227, 790, 1522, 1003),(1260, 825, 1490, 970)),
]
R = 12  # search radius (px) around each rough edge; thin frames need a tighter search
TIGHT = {"thin-black": 3, "thin-gold": 3, "white-chippy": 5, "black-vine": 5, "driftwood": 5}


def snap_x(x, y0, y1):
    lo, hi = max(1, x - R), min(g.shape[1] - 1, x + R)
    span = gx[y0 + (y1 - y0) // 4: y1 - (y1 - y0) // 4, lo:hi].mean(axis=0)
    return lo + int(span.argmax())


def snap_y(y, x0, x1):
    lo, hi = max(1, y - R), min(g.shape[0] - 1, y + R)
    span = gy[lo:hi, x0 + (x1 - x0) // 4: x1 - (x1 - x0) // 4].mean(axis=1)
    return lo + int(span.argmax())


meta = []
for i, (name, (ox0, oy0, ox1, oy1), (ix0, iy0, ix1, iy1)) in enumerate(F, 1):
    R = TIGHT.get(name, 12)
    ox0, ox1 = snap_x(ox0, oy0, oy1), snap_x(ox1, oy0, oy1)
    oy0, oy1 = snap_y(oy0, ox0, ox1), snap_y(oy1, ox0, ox1)
    ix0, ix1 = snap_x(ix0, iy0, iy1), snap_x(ix1, iy0, iy1)
    iy0, iy1 = snap_y(iy0, ix0, ix1), snap_y(iy1, ix0, ix1)
    # Trim 2px inside the outer edge (no background fringe); slice 2px short of the opening
    # (so the painting butts against the frame's lip, never showing parchment).
    x0, y0, x1, y1 = ox0 + 2, oy0 + 2, ox1 - 2, oy1 - 2
    sides = [iy0 - y0 + 2, x1 - ix1 + 2, y1 - iy1 + 2, ix0 - x0 + 2]  # top right bottom left
    # One even thickness, the thinnest measured side: never reaches past the lip into parchment.
    sl = [min(sides)] * 4
    crop = im.crop((x0, y0, x1, y1))
    crop.save(out / f"{name}.webp", quality=90, method=6)
    meta.append({"id": i, "name": name, "w": x1 - x0, "h": y1 - y0, "slice": sl})
    print(i, name, crop.size, "slice", sl)

(out / "frames.json").write_text(json.dumps(meta, indent=1))

# Preview: each frame on the oxblood wall with a green line where the slice falls.
cols, pad = 5, 12
tw = max(m["w"] for m in meta) + pad
th = max(m["h"] for m in meta) + pad + 14
sheet_img = Image.new("RGB", (tw * cols, th * ((len(meta) + cols - 1) // cols)), (74, 20, 24))
d = ImageDraw.Draw(sheet_img)
for k, m in enumerate(meta):
    px, py = (k % cols) * tw + 6, (k // cols) * th + 18
    sheet_img.paste(Image.open(out / f"{m['name']}.webp"), (px, py))
    t, r, b, l = m["slice"]
    d.rectangle([px + l, py + t, px + m["w"] - r, py + m["h"] - b], outline=(0, 255, 120), width=1)
    d.text((px, py - 14), f"{m['id']} {m['name']}", fill=(255, 255, 255))
sheet_img.save(out / "_contact.jpg", quality=85)
