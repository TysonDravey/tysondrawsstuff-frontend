"""Straighten + crop photos of framed paintings hanging on a light wall.

1. Find the frame: wood is warm-toned or dark; the wall is a light, neutral grey/white.
2. Trace each outer edge of the frame along its length and fit a gentle curve (quadratic) to it,
   which captures both camera perspective and lens (barrel) bow.
3. Warp with a mesh (Coons patch between the four curved edges) so they come out dead straight,
   then trim a hair inside the edge so no wall survives.

usage: python straighten_framed_photo.py [--radius=0.022] OUT_DIR IMAGE [IMAGE ...]
  --radius  corner rounding as a fraction of the width (0.022 suits the rounded Krampus frames;
            use ~0.004 for a square-cornered frame)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

opts = [a for a in sys.argv[1:] if a.startswith("--")]
args = [a for a in sys.argv[1:] if not a.startswith("--")]
out_dir = Path(args[0])
out_dir.mkdir(parents=True, exist_ok=True)
MAX = 2000      # the site shows at most 1600px
GRID = 24       # mesh cells per side
INSET = 0.003   # trim this fraction inside each edge
RADIUS = next((float(o.split("=", 1)[1]) for o in opts if o.startswith("--radius=")), 0.022)  # corner rounding


def frame_mask(im):
    """The frame is a different hue from the wall; the wall and the frame's cast shadow share one hue
    (a shadow is just darker wall), so compare chromaticity against the wall colour at the photo's border."""
    a = ndimage.uniform_filter(np.asarray(im, dtype=np.float32), size=(5, 5, 1)) + 1
    ch = a / a.sum(axis=2, keepdims=True)
    border = np.concatenate([ch[:10].reshape(-1, 3), ch[-10:].reshape(-1, 3),
                             ch[:, :10].reshape(-1, 3), ch[:, -10:].reshape(-1, 3)])
    wall = np.median(border, axis=0)
    d = np.linalg.norm(ch - wall, axis=2)
    lum = a.mean(axis=2) / 256
    m = (d > 0.035) | (lum < 0.12)
    m = ndimage.binary_opening(m, structure=np.ones((7, 7)))
    m = ndimage.binary_closing(m, structure=np.ones((15, 15)))
    labels, n = ndimage.label(m)
    sizes = ndimage.sum(m, labels, range(1, n + 1))
    return ndimage.binary_fill_holes(labels == (int(np.argmax(sizes)) + 1))


def tone_mask(im):
    a = np.asarray(im, dtype=np.float32) / 255
    mx, mn = a.max(axis=2), a.min(axis=2)
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    m = (lum < 0.43) | ((sat > 0.2) & (lum < 0.94))
    m = ndimage.binary_opening(m, structure=np.ones((5, 5)))
    m = ndimage.binary_closing(m, structure=np.ones((15, 15)))
    labels, n = ndimage.label(m)
    sizes = ndimage.sum(m, labels, range(1, n + 1))
    return ndimage.binary_fill_holes(labels == (int(np.argmax(sizes)) + 1))


def first_true(arr, axis, reverse=False):
    """Index of the first True along axis (from the end if reverse); -1 where none."""
    a = np.flip(arr, axis=axis) if reverse else arr
    idx = a.argmax(axis=axis)
    has = a.any(axis=axis)
    if reverse:
        idx = arr.shape[axis] - 1 - idx
    return np.where(has, idx, -1)


def refine(grad, lines, start, inward, axis, span=130):
    """For each scan line, the outermost sharp colour step between `start` (rough outer edge) and
    `span` px inward. Soft shadow edges never clear the threshold; the frame's silhouette does."""
    out = np.full(len(lines), -1.0)
    for i, (ln, s0) in enumerate(zip(lines, start)):
        if s0 < 0:
            continue
        a, b = (s0 - 15, s0 + span) if inward > 0 else (s0 - span, s0 + 15)
        a, b = max(a, 0), min(b, grad.shape[axis] - 1)
        prof = grad[ln, a:b] if axis == 1 else grad[a:b, ln]
        if prof.size < 5 or prof.max() <= 0:
            continue
        idx = np.nonzero(prof > 0.45 * prof.max())[0]
        out[i] = a + (idx[0] if inward > 0 else idx[-1])
    return out


def robust_quadfit(t, y, iters=4, max_bow=14.0):
    """Quadratic y(t), refitting without the worst outliers. A lens bows an edge only a little;
    anything curvier is the mask misbehaving, so fall back to a straight line."""
    ok = y >= 0
    t, y = t[ok], y[ok]
    for deg in (2, 1):
        keep = np.ones_like(t, bool)
        for _ in range(iters):
            c = np.polyfit(t[keep], y[keep], deg)
            r = np.abs(np.polyval(c, t) - y)
            keep = r < max(2.5 * np.median(r[keep]), 2.0)
        if deg == 1:
            return np.concatenate([[0.0], c])
        a, b = t.min(), t.max()
        bow = abs(np.polyval(c, (a + b) / 2) - (np.polyval(c, a) + np.polyval(c, b)) / 2)
        if bow <= max_bow:
            return c


def solve_perspective(dst, src):
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return np.linalg.solve(np.array(A, float), np.array(b, float))


for path in map(Path, args[1:]):
    im = Image.open(path).convert("RGBA").convert("RGB")
    im.thumbnail((MAX, MAX))
    H, W = im.height, im.width
    m1, m2 = frame_mask(im), tone_mask(im)
    blob = m1 & m2
    ys, xs = np.nonzero(blob)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    # Sample the edges away from the corners (middle 80%), where they're cleanly measurable.
    cols = np.arange(int(x0 + 0.1 * (x1 - x0)), int(x1 - 0.1 * (x1 - x0)))
    rows = np.arange(int(y0 + 0.1 * (y1 - y0)), int(y1 - 0.1 * (y1 - y0)))
    # Rough outer edge from the union of the masks, refined to the outermost sharp colour step.
    u = m1 | m2
    g = np.asarray(im, dtype=np.float32)
    g = ndimage.gaussian_filter(g, (1.2, 1.2, 0))
    grad = np.sqrt(sum(ndimage.sobel(g[..., c], 0) ** 2 + ndimage.sobel(g[..., c], 1) ** 2 for c in range(3)))
    grad = ndimage.median_filter(grad, size=(5, 5))
    top = refine(grad, cols, first_true(u[:, cols], 0), +1, 0)
    bot = refine(grad, cols, first_true(u[:, cols], 0, reverse=True), -1, 0)
    lef = refine(grad, rows, first_true(u[rows, :], 1), +1, 1)
    rig = refine(grad, rows, first_true(u[rows, :], 1, reverse=True), -1, 1)
    ct = robust_quadfit(cols.astype(float), top.astype(float))
    cb = robust_quadfit(cols.astype(float), bot.astype(float))
    cl = robust_quadfit(rows.astype(float), lef.astype(float))
    cr = robust_quadfit(rows.astype(float), rig.astype(float))
    # Move each fitted edge a hair inward.
    k = INSET * max(W, H)
    T = lambda x: np.polyval(ct, x) + k
    B = lambda x: np.polyval(cb, x) - k
    L = lambda y: np.polyval(cl, y) + k
    R = lambda y: np.polyval(cr, y) - k

    def corner(fy, fx, x, y):
        for _ in range(20):
            y = fy(x); x = fx(y)
        return np.array([x, y])

    tl = corner(T, L, x0, y0); tr = corner(T, R, x1, y0)
    bl = corner(B, L, x0, y1); br = corner(B, R, x1, y1)
    w = int(round((np.linalg.norm(tr - tl) + np.linalg.norm(br - bl)) / 2))
    h = int(round((np.linalg.norm(bl - tl) + np.linalg.norm(br - tr)) / 2))

    def src(u, v):
        """Coons patch: output (u, v) in [0,1]^2 → source pixel between the four curved edges."""
        xt = tl[0] + u * (tr[0] - tl[0]); top_p = np.array([xt, T(xt)])
        xb = bl[0] + u * (br[0] - bl[0]); bot_p = np.array([xb, B(xb)])
        yl = tl[1] + v * (bl[1] - tl[1]); lef_p = np.array([L(yl), yl])
        yr = tr[1] + v * (br[1] - tr[1]); rig_p = np.array([R(yr), yr])
        return ((1 - v) * top_p + v * bot_p + (1 - u) * lef_p + u * rig_p
                - ((1 - u) * (1 - v) * tl + u * (1 - v) * tr + (1 - u) * v * bl + u * v * br))

    mesh = []
    for i in range(GRID):
        for j in range(GRID):
            u0, u1, v0, v1 = j / GRID, (j + 1) / GRID, i / GRID, (i + 1) / GRID
            box = (round(u0 * w), round(v0 * h), round(u1 * w), round(v1 * h))
            nw, sw, se, ne = src(u0, v0), src(u0, v1), src(u1, v1), src(u1, v0)
            mesh.append((box, (*nw, *sw, *se, *ne)))
    # Rounded frame corners: cut the wall away with an alpha mask (slightly eroded, soft edge).
    flat = im.transform((w, h), Image.MESH, mesh, Image.BICUBIC)
    # Shave any edge rows/columns that are still mostly wall (or its shadow): same hue as the wall.
    a = np.asarray(flat, np.float32) + 1
    ch = a / a.sum(axis=2, keepdims=True)
    src_a = np.asarray(im, np.float32) + 1
    src_ch = src_a / src_a.sum(axis=2, keepdims=True)
    wall = np.median(np.concatenate([src_ch[:10].reshape(-1, 3), src_ch[-10:].reshape(-1, 3)]), axis=0)
    wallish = np.linalg.norm(ch - wall, axis=2) < 0.03
    def run(fracs):
        n = 0
        for f in fracs:
            if f < 0.35: break
            n += 1
        return n
    cut_b = run(wallish[::-1, int(w * .2):int(w * .8)].mean(axis=1)[:200])
    cut_t = run(wallish[:, int(w * .2):int(w * .8)].mean(axis=1)[:200])
    cut_r = run(wallish[int(h * .2):int(h * .8), ::-1].mean(axis=0)[:200])
    cut_l = run(wallish[int(h * .2):int(h * .8), :].mean(axis=0)[:200])
    pad = lambda n: n + 3 if n else 0
    flat = flat.crop((pad(cut_l), pad(cut_t), w - pad(cut_r), h - pad(cut_b))).convert("RGBA")
    w, h = flat.size
    S = 4  # supersampled rounded-rect alpha
    alpha = Image.new("L", (w * S, h * S), 0)
    ImageDraw.Draw(alpha).rounded_rectangle((0, 0, w * S - 1, h * S - 1), radius=RADIUS * w * S, fill=255)
    alpha = np.asarray(alpha.resize((w, h), Image.LANCZOS), np.float32)
    # Follow the real silhouette near each edge: clear wall-hued runs coming in from the border.
    a = np.asarray(flat.convert("RGB"), np.float32) / 255
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    wood = (sat > 0.38) | (mx < 0.3)  # wood and resin are saturated or dark; wall and shadow are pale grey
    wood = ndimage.binary_opening(wood, structure=np.ones((5, 5)))
    wallish = ~wood
    def runs(m):  # length of the non-wood run in from index 0 along axis 0, per column (max 220)
        m = m[:220]
        r = np.where(m.all(axis=0), m.shape[0], (~m).argmax(axis=0))
        return ndimage.median_filter(r, size=21)
    cut = np.zeros((h, w), bool)
    yy, xx = np.mgrid[0:h, 0:w]
    # Only the bottom: light comes from above, so the cast shadow and the frame's lower lip sit there.
    # (Top and sides are already clean from the edge fit, and pale maple would fail the wood test.)
    cut |= (h - 1 - yy) < ndimage.median_filter(runs(wallish[::-1]), size=41)[None, :]
    cut = ndimage.binary_dilation(cut, iterations=2)
    soft = ndimage.gaussian_filter(np.where(cut, 0, 255).astype(np.float32), 1.0)
    flat.putalpha(Image.fromarray(np.minimum(alpha, soft).astype(np.uint8)))
    out = out_dir / (path.stem.rsplit("_", 1)[0] + ".webp")
    flat.save(out, quality=90, method=6)
    bow = lambda c, a, b: abs(np.polyval(c, (a + b) / 2) - (np.polyval(c, a) + np.polyval(c, b)) / 2)
    print(f"{path.name}: {w}x{h}, shaved t{cut_t} b{cut_b} l{cut_l} r{cut_r}, edge bow top {bow(ct, x0, x1):.1f}px bottom {bow(cb, x0, x1):.1f}px "
          f"left {bow(cl, y0, y1):.1f}px right {bow(cr, y0, y1):.1f}px -> {out.name}")
