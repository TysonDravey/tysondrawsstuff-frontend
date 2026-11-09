"""
Corner picker for photos of framed paintings: drag the four corner dots onto the frame's outer corners,
check the straightened preview, Save. Several photos (a triptych) are hung side by side, same height,
small gap, on a transparent background, and written to public/framed/NAME.webp; the size in
src/lib/images.ts (FRAMED_CUTOUTS) is updated to match. Corners are remembered in corners/NAME.json.

    tools\\venv\\Scripts\\python scripts\\frames\\corner_picker.py NAME PHOTO [PHOTO ...]
    tools\\venv\\Scripts\\python scripts\\frames\\corner_picker.py station_beach_framed_01     (reopen: photos from the json)

Mouse: drag a dot (the magnifier shows where it lands). Keys: Tab = next dot, arrows = nudge the selected
dot 1 screen pixel (Shift = 10), 1/2/3… = switch photo.
The Strapi product needs a photo whose file name starts with NAME (e.g. NAME.jpg) so the site knows to
use this cut-out; upload that once.
"""
from __future__ import annotations

import json
import re
import sys
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

import numpy as np
from PIL import Image, ImageOps, ImageTk

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parent.parent
CORNERS = HERE / "corners"
OUT_H = 900        # height of the finished image (px)
GAP = 0.05         # gap between panels, share of the height
INSET = 0.004      # trim this share inside the corners, so no wall survives
VIEW = (900, 760)  # photo area on screen
LOUPE, ZOOM = 180, 4


def coeffs(dst, src):
    a, b = [], []
    for (x, y), (X, Y) in zip(dst, src):
        a += [[x, y, 1, 0, 0, 0, -X * x, -X * y], [0, 0, 0, x, y, 1, -Y * x, -Y * y]]
        b += [X, Y]
    return np.linalg.solve(np.array(a, float), np.array(b, float))


def straighten(im: Image.Image, pts: list[tuple[float, float]]) -> Image.Image:
    d = lambda p, q: float(np.hypot(p[0] - q[0], p[1] - q[1]))  # noqa: E731
    w = round((d(pts[0], pts[1]) + d(pts[3], pts[2])) / 2)
    h = round((d(pts[0], pts[3]) + d(pts[1], pts[2])) / 2)
    out = im.transform((w, h), Image.PERSPECTIVE, coeffs([(0, 0), (w, 0), (w, h), (0, h)], pts), Image.BICUBIC)
    k = round(min(w, h) * INSET)
    return out.crop((k, k, w - k, h - k))


def hang(panels: list[Image.Image]) -> Image.Image:
    gap = round(OUT_H * GAP)
    ims = [p.resize((round(p.width * OUT_H / p.height), OUT_H), Image.LANCZOS) for p in panels]
    out = Image.new("RGBA", (sum(i.width for i in ims) + gap * (len(ims) - 1), OUT_H), (0, 0, 0, 0))
    x = 0
    for i in ims:
        out.paste(i.convert("RGBA"), (x, 0))
        x += i.width + gap
    return out


class App(tk.Tk):
    def __init__(self, name: str, photos: list[str], corners: list | None):
        super().__init__()
        self.title(f"Corner picker: {name}")
        self.name = name
        self.photos = photos
        self.ims = [ImageOps.exif_transpose(Image.open(p)).convert("RGB") for p in photos]
        self.pts = corners or [[(w * .1, h * .1), (w * .9, h * .1), (w * .9, h * .9), (w * .1, h * .9)]
                               for w, h in (im.size for im in self.ims)]
        self.pts = [[tuple(p) for p in c] for c in self.pts]
        self.cur, self.sel, self.drag = 0, 0, False

        top = ttk.Frame(self, padding=6)
        top.pack(fill="x")
        for i in range(len(self.ims)):
            ttk.Button(top, text=f"Photo {i + 1}", command=lambda i=i: self.show(i)).pack(side="left", padx=2)
        ttk.Button(top, text="Save", command=self.save).pack(side="right", padx=4)
        ttk.Label(top, text="Drag the dots onto the frame's OUTER corners.  Tab: next dot · arrows: nudge "
                            "(Shift ×10)", foreground="#555").pack(side="left", padx=12)
        body = ttk.Frame(self)
        body.pack(fill="both", expand=True)
        self.cv = tk.Canvas(body, width=VIEW[0], height=VIEW[1], bg="#222", highlightthickness=0)
        self.cv.pack(side="left", padx=6, pady=6)
        right = ttk.Frame(body)
        right.pack(side="left", fill="y", padx=6, pady=6)
        ttk.Label(right, text="Magnifier").pack(anchor="w")
        self.loupe = tk.Canvas(right, width=LOUPE, height=LOUPE, bg="#111", highlightthickness=0)
        self.loupe.pack(anchor="w")
        ttk.Label(right, text="This photo, straightened").pack(anchor="w", pady=(10, 0))
        self.one = ttk.Label(right)
        self.one.pack(anchor="w")
        ttk.Label(self, text="All panels, as they'll hang").pack(anchor="w", padx=8)
        self.all = ttk.Label(self)
        self.all.pack(anchor="w", padx=8, pady=(0, 8))

        self.cv.bind("<ButtonPress-1>", self.press)
        self.cv.bind("<B1-Motion>", self.move)
        self.cv.bind("<ButtonRelease-1>", self.release)
        self.bind("<Tab>", lambda e: (self.select((self.sel + 1) % 4), "break")[1])
        for key, dx, dy in (("Left", -1, 0), ("Right", 1, 0), ("Up", 0, -1), ("Down", 0, 1)):
            self.bind(f"<{key}>", lambda e, dx=dx, dy=dy: self.nudge(dx, dy, 1))
            self.bind(f"<Shift-{key}>", lambda e, dx=dx, dy=dy: self.nudge(dx, dy, 10))
        for i in range(len(self.ims)):
            self.bind(str(i + 1), lambda e, i=i: self.show(i))
        self.show(0)
        self.preview_all()

    # ---- drawing
    def show(self, i: int):
        self.cur = i
        im = self.ims[i]
        self.s = min(VIEW[0] / im.width, VIEW[1] / im.height)
        small = im.resize((round(im.width * self.s), round(im.height * self.s)))
        self.tkimg = ImageTk.PhotoImage(small)
        self.select(self.sel)

    def select(self, k: int):
        self.sel = k
        self.redraw()
        self.draw_loupe()

    def redraw(self):
        cv, s = self.cv, self.s
        cv.delete("all")
        cv.create_image(0, 0, image=self.tkimg, anchor="nw")
        p = [(x * s, y * s) for x, y in self.pts[self.cur]]
        cv.create_polygon(*sum(p, ()), outline="#00ff88", fill="", width=1)
        for k, (x, y) in enumerate(p):
            r = 7 if k == self.sel else 5
            cv.create_oval(x - r, y - r, x + r, y + r, outline="#ff3b6b" if k == self.sel else "#00ff88", width=2)
            cv.create_text(x + 12, y - 12, text="TL TR BR BL".split()[k], fill="white")

    def draw_loupe(self):
        x, y = self.pts[self.cur][self.sel]
        half = LOUPE / ZOOM / 2 / self.s  # source pixels around the dot
        box = (int(x - half), int(y - half), int(x + half), int(y + half))
        crop = self.ims[self.cur].crop(box).resize((LOUPE, LOUPE), Image.NEAREST)
        self.loupe_img = ImageTk.PhotoImage(crop)
        self.loupe.delete("all")
        self.loupe.create_image(0, 0, image=self.loupe_img, anchor="nw")
        c = LOUPE / 2
        self.loupe.create_line(c, 0, c, LOUPE, fill="#ff3b6b")
        self.loupe.create_line(0, c, LOUPE, c, fill="#ff3b6b")

    def preview_one(self):
        im = straighten(self.ims[self.cur], self.pts[self.cur])
        im.thumbnail((300, 300))
        self.one_img = ImageTk.PhotoImage(im)
        self.one.config(image=self.one_img)

    def preview_all(self):
        out = hang([straighten(im, p) for im, p in zip(self.ims, self.pts)])
        bg = Image.new("RGB", out.size, (74, 20, 24))
        bg.paste(out, mask=out.split()[3])
        bg.thumbnail((1200, 260))
        self.all_img = ImageTk.PhotoImage(bg)
        self.all.config(image=self.all_img)
        self.preview_one()

    # ---- editing
    def press(self, e):
        p = [(x * self.s, y * self.s) for x, y in self.pts[self.cur]]
        k = min(range(4), key=lambda k: (p[k][0] - e.x) ** 2 + (p[k][1] - e.y) ** 2)
        self.drag = True
        self.select(k)
        self.move(e)

    def move(self, e):
        if not self.drag:
            return
        im = self.ims[self.cur]
        x = min(max(e.x / self.s, 0), im.width - 1)
        y = min(max(e.y / self.s, 0), im.height - 1)
        self.pts[self.cur][self.sel] = (x, y)
        self.redraw()
        self.draw_loupe()

    def release(self, _e):
        self.drag = False
        self.preview_all()

    def nudge(self, dx, dy, n):
        x, y = self.pts[self.cur][self.sel]
        self.pts[self.cur][self.sel] = (x + dx * n / self.s, y + dy * n / self.s)
        self.redraw()
        self.draw_loupe()
        self.after_idle(self.preview_all)

    # ---- saving
    def save(self):
        out = hang([straighten(im, p) for im, p in zip(self.ims, self.pts)])
        dest = FRONTEND / "public" / "framed" / f"{self.name}.webp"
        out.save(dest, quality=88, method=6)
        CORNERS.mkdir(exist_ok=True)
        (CORNERS / f"{self.name}.json").write_text(json.dumps(
            {"photos": self.photos, "corners": [[[round(x, 1), round(y, 1)] for x, y in c] for c in self.pts]},
            indent=1))
        ts = FRONTEND / "src" / "lib" / "images.ts"
        src = ts.read_text(encoding="utf-8")
        line = f"  {self.name}: {{ width: {out.width}, height: {out.height} }},"
        pat = re.compile(rf"^  {re.escape(self.name)}: \{{ width: \d+, height: \d+ \}},", re.M)
        if pat.search(src):
            src = pat.sub(line, src)
        else:
            src = src.replace("const FRAMED_CUTOUTS: Record<string, { width: number; height: number }> = {\n",
                              "const FRAMED_CUTOUTS: Record<string, { width: number; height: number }> = {\n"
                              + line + "\n", 1)
        ts.write_text(src, encoding="utf-8")
        messagebox.showinfo("Saved", f"Wrote public/framed/{self.name}.webp ({out.width}×{out.height})\n"
                                     f"and updated src/lib/images.ts.\n\nCommit those two, push to develop, "
                                     f"Deploy Preview to see it.")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    name, photos = sys.argv[1], sys.argv[2:]
    saved = json.loads((CORNERS / f"{name}.json").read_text()) if (CORNERS / f"{name}.json").exists() else {}
    if not photos:
        photos = saved.get("photos") or sys.exit(f"No photos given and no corners/{name}.json yet.")
    corners = saved.get("corners") if saved.get("photos") == photos else None
    App(name, photos, corners).mainloop()


if __name__ == "__main__":
    main()
