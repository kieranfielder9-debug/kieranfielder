"""Paper, ink, type & film helpers — the 'riza' look.

Everything hand-drawn wobbles ("boils") at 7.5 fps like redrawn animation.
"""
import math
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from config import ASSETS, H, W

INK = (44, 38, 33, 255)
CHALK = (238, 236, 228, 255)
RED = (186, 50, 38, 255)
MARKER = (255, 208, 56, 115)
PAPER_CREAM = (233, 224, 202)
PAPER_NAVY = (25, 31, 50)
PAPER_DARK = (15, 16, 21)

_fonts = {}


def font(name, size):
    key = (name, size)
    if key not in _fonts:
        f = ImageFont.truetype(str(ASSETS / f"{name}.ttf"), size)
        if name == "caveat":  # variable font — thicken for marker-pen weight
            try:
                f.set_variation_by_axes([640])
            except Exception:
                pass
        _fonts[key] = f
    return _fonts[key]


def boil(f):
    return f // 4


def rng_for(salt, b=0):
    return np.random.default_rng((abs(hash((salt, b))) % (2**63)) or 7)


def ease_out(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def ease_in(x):
    x = min(max(x, 0.0), 1.0)
    return x**3


def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def pop(tp, dur=0.30):
    """easeOutBack scale for slap-in elements; None until tp>0."""
    if tp <= 0:
        return None
    x = min(tp / dur, 1.0)
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


# ---------------------------------------------------------------- hand lines
def _resample(pts, step=15.0):
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(1, int(d / step))
        for i in range(1, n + 1):
            out.append((a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n))
    return out


def hand_path(draw, pts, color=INK, width=6, salt=0, b=0, jitter=1.7,
              progress=1.0, closed=False):
    """Wobbly ink polyline with stroke-reveal via `progress`."""
    if closed:
        pts = list(pts) + [pts[0]]
    rs = _resample(pts)
    r = rng_for(("path", salt), b)
    j = r.normal(0, jitter, (len(rs), 2))
    j[0] *= 0.4
    j[-1] *= 0.4
    wob = [(p[0] + j[i][0], p[1] + j[i][1]) for i, p in enumerate(rs)]
    k = max(2, int(len(wob) * min(max(progress, 0.0), 1.0)))
    wob = wob[:k]
    draw.line(wob, fill=color, width=width, joint="curve")
    for p in (wob[0], wob[-1]):
        draw.ellipse([p[0] - width / 2, p[1] - width / 2,
                      p[0] + width / 2, p[1] + width / 2], fill=color)


def hand_ellipse(draw, center, rx, ry=None, color=INK, width=6, salt=0, b=0,
                 progress=1.0, overshoot=35, jitter=2.2):
    """Sketchy circle that overlaps itself a little, like a real pen circle."""
    ry = ry if ry is not None else rx
    cx, cy = center
    a0 = -80
    pts = []
    for a in range(a0, a0 + 360 + overshoot, 9):
        t = math.radians(a)
        pts.append((cx + rx * math.cos(t), cy + ry * math.sin(t)))
    hand_path(draw, pts, color, width, salt=("ell", salt), b=b,
              jitter=jitter, progress=progress)


def hand_arrow(draw, p0, p1, color=INK, width=6, salt=0, b=0, progress=1.0,
               curve=0.18):
    """Curved annotation arrow with a sketchy head."""
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    ctrl = (mx - dy * curve, my + dx * curve)
    pts = []
    for i in range(13):
        u = i / 12
        x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * ctrl[0] + u**2 * p1[0]
        y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * ctrl[1] + u**2 * p1[1]
        pts.append((x, y))
    hand_path(draw, pts, color, width, salt=("arr", salt), b=b, progress=progress)
    if progress >= 0.96:
        ang = math.atan2(p1[1] - pts[-3][1], p1[0] - pts[-3][0])
        ln = 7 + width * 2.2
        for da in (math.radians(152), math.radians(-152)):
            q = (p1[0] + ln * math.cos(ang + da), p1[1] + ln * math.sin(ang + da))
            hand_path(draw, [p1, q], color, width, salt=("arh", salt, da), b=b)


def sparkle(draw, center, r=16, color=INK, width=5, salt=0, b=0):
    cx, cy = center
    hand_path(draw, [(cx - r, cy), (cx + r, cy)], color, width, ("sp1", salt), b)
    hand_path(draw, [(cx, cy - r), (cx, cy + r)], color, width, ("sp2", salt), b)
    d = r * 0.55
    hand_path(draw, [(cx - d, cy - d), (cx + d, cy + d)], color, max(2, width - 2), ("sp3", salt), b)
    hand_path(draw, [(cx - d, cy + d), (cx + d, cy - d)], color, max(2, width - 2), ("sp4", salt), b)


def scribble_disc(draw, center, r, color, salt=0, b=0, turns=4, width=7):
    """Spiral scribble used for smoke puffs / dust."""
    cx, cy = center
    pts = []
    n = int(18 * turns)
    for i in range(n):
        u = i / (n - 1)
        a = u * turns * 2 * math.pi
        rr = r * (0.15 + 0.85 * u)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a) * 0.85))
    hand_path(draw, pts, color, width, salt=("scr", salt), b=b, jitter=2.6)


# ---------------------------------------------------------------- typography
_tiles = {}


def text_tile(text, fnt, fill, stroke=0, stroke_fill=None):
    key = (text, fnt.path, fnt.size, fill, stroke, stroke_fill)
    if key in _tiles:
        return _tiles[key]
    pad = 28 + stroke
    tmp = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    bb = tmp.textbbox((0, 0), text, font=fnt, stroke_width=stroke)
    tile = Image.new("RGBA", (bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad))
    ImageDraw.Draw(tile).text((pad - bb[0], pad - bb[1]), text, font=fnt,
                              fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    if len(_tiles) > 600:
        _tiles.clear()
    _tiles[key] = tile
    return tile


def put(canvas, tile, center, angle=0.0, scale=1.0, alpha=255):
    if scale <= 0.01:
        return
    if scale != 1.0:
        tile = tile.resize((max(1, int(tile.width * scale)),
                            max(1, int(tile.height * scale))),
                           Image.Resampling.BILINEAR)
    if angle:
        tile = tile.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    if alpha < 255:
        a = tile.getchannel("A").point(lambda v: v * alpha // 255)
        tile = tile.copy()
        tile.putalpha(a)
    canvas.alpha_composite(tile, (int(center[0] - tile.width / 2),
                                  int(center[1] - tile.height / 2)))


def pop_word(canvas, text, fnt, center, tp, color=INK, angle=0.0, dur=0.3):
    s = pop(tp, dur)
    if s is None:
        return False
    put(canvas, text_tile(text, fnt, color), center, angle=angle, scale=s,
        alpha=int(255 * min(1, tp / 0.1)))
    return True


def typewriter(canvas, xy, text, fnt, tp, cps, color=INK, f=0, cursor=True):
    """Left-anchored typed text; returns True when started."""
    if tp <= 0:
        return False
    n = min(len(text), int(tp * cps))
    shown = text[:n]
    tile = text_tile(shown if shown else " ", fnt, color)
    canvas.alpha_composite(tile, (int(xy[0]) - 28, int(xy[1]) - tile.height // 2))
    if cursor and n < len(text) and (f // 8) % 2 == 0:
        wpx = fnt.getlength(shown)
        d = ImageDraw.Draw(canvas)
        d.rectangle([xy[0] + wpx + 4, xy[1] - fnt.size * 0.38,
                     xy[0] + wpx + 4 + fnt.size * 0.45, xy[1] + fnt.size * 0.38],
                    fill=color)
    return True


def marker_swipe(canvas, center, width_px, tp, color=MARKER, h=44, angle=-1.5,
                 dur=0.35):
    """Highlighter stroke sweeping left→right behind text."""
    if tp <= 0:
        return
    u = ease_out(tp / dur)
    wpx = max(8, int(width_px * u))
    tile = Image.new("RGBA", (wpx + 40, h + 26))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle([8, 10, wpx + 28, h + 12], radius=h // 2, fill=color)
    put(canvas, tile, (center[0] - (width_px - wpx) / 2, center[1]), angle=angle)


# ---------------------------------------------------------------- props
@lru_cache(maxsize=None)
def stamp(text, size=46, color=(186, 50, 38), pad_x=30, pad_y=16):
    fnt = font("specialelite", size)
    t = text_tile(text, fnt, color + (255,))
    w, h = int(fnt.getlength(text)) + 2 * pad_x + 16, size + 2 * pad_y + 10
    tile = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle([4, 4, w - 5, h - 5], radius=10, outline=color + (255,), width=6)
    put(tile, t, (w // 2, h // 2 - 2))
    arr = np.array(tile, dtype=np.float32)
    r = rng_for(("stamp", text))
    fine = r.random((h, w))
    coarse = np.array(Image.fromarray(
        (r.random((max(2, h // 14), max(2, w // 14))) * 255).astype(np.uint8)
    ).resize((w, h), Image.Resampling.BILINEAR), dtype=np.float32) / 255.0
    mask = np.clip(0.25 + fine * 0.75, 0, 1) * np.clip(0.45 + coarse * 0.9, 0, 1)
    arr[..., 3] *= np.clip(mask * 1.25, 0, 1)
    return Image.fromarray(arr.astype(np.uint8))


def tape(canvas, center, angle=40, w=170, h=46, color=(247, 238, 205, 150)):
    tile = Image.new("RGBA", (w, h), color)
    d = ImageDraw.Draw(tile)  # direct write: the torn ends punch through
    r = rng_for(("tape", center, angle))
    for x0 in (0, w - 12):
        zig = [(x0 + (12 if x0 == 0 else 0), 0)]
        for yy in range(0, h + 1, 6):
            zig.append((x0 + r.uniform(0, 12), yy))
        zig.append((x0 + (12 if x0 == 0 else 0), h))
        d.polygon(zig, fill=(0, 0, 0, 0))
    db = ImageDraw.Draw(tile, "RGBA")
    for xx in range(10, w - 10, 9):
        db.line([(xx, 2), (xx, h - 2)], fill=(255, 255, 255, 16), width=2)
    put(canvas, tile, center, angle=angle)


@lru_cache(maxsize=None)
def _shadow_tile(w, h, rad=14, blur=7, a=80):
    s = Image.new("RGBA", (w + 60, h + 60))
    ImageDraw.Draw(s).rounded_rectangle([30, 30, 30 + w, 30 + h], radius=rad,
                                        fill=(20, 14, 8, a))
    return s.filter(ImageFilter.GaussianBlur(blur))


def card(photo, caption=None, cap_size=46, pad=22, bottom=86,
         paper=(250, 247, 240, 255)):
    """Polaroid-style card (with drop shadow baked in) around a photo."""
    w = photo.width + 2 * pad
    h = photo.height + pad + bottom
    tile = Image.new("RGBA", (w + 60, h + 60))
    tile.alpha_composite(_shadow_tile(w, h), (10, 14))
    d = ImageDraw.Draw(tile, "RGBA")
    d.rounded_rectangle([30, 30, 30 + w, 30 + h], radius=6, fill=paper)
    tile.alpha_composite(photo.convert("RGBA"), (30 + pad, 30 + pad))
    d.rectangle([30 + pad, 30 + pad, 30 + pad + photo.width, 30 + pad + photo.height],
                outline=(0, 0, 0, 36), width=2)
    if caption:
        put(tile, text_tile(caption, font("caveat", cap_size), INK),
            (30 + w // 2, 30 + h - bottom // 2 - 4))
    return tile


# ---------------------------------------------------------------- papers
@lru_cache(maxsize=None)
def paper(kind="cream"):
    r = rng_for(("paper", kind))
    base = {"cream": PAPER_CREAM, "navy": PAPER_NAVY, "dark": PAPER_DARK}[kind]
    arr = np.full((H, W, 3), base, dtype=np.float32)
    arr += r.normal(0, 4.2 if kind == "cream" else 2.8, (H, W, 1))
    blotch = Image.fromarray(
        (np.clip(r.normal(128, 26, (H // 48, W // 48)), 0, 255)).astype(np.uint8)
    ).resize((W, H), Image.Resampling.BILINEAR)
    arr += (np.asarray(blotch, dtype=np.float32)[..., None] - 128) * 0.10
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    if kind == "cream":
        for _ in range(240):  # paper fibres
            x, y = r.uniform(0, W), r.uniform(0, H)
            a = r.uniform(0, math.pi)
            ln = r.uniform(7, 26)
            d.line([(x, y), (x + ln * math.cos(a), y + ln * math.sin(a))],
                   fill=(120, 104, 80, int(r.uniform(10, 26))), width=1)
    else:
        stars = 150 if kind == "navy" else 40
        for i in range(stars):
            x, y = r.uniform(0, W), r.uniform(0, H)
            rad = r.uniform(0.8, 2.6)
            al = int(r.uniform(90, 230))
            d.ellipse([x - rad, y - rad, x + rad, y + rad],
                      fill=(238, 236, 224, al))
        if kind == "navy":
            for i in range(7):  # faint constellations
                cx, cy = r.uniform(100, W - 100), r.uniform(80, H - 80)
                ps = [(cx + r.uniform(-130, 130), cy + r.uniform(-90, 90))
                      for _ in range(r.integers(3, 6))]
                d.line(ps, fill=(238, 236, 224, 26), width=2)
                for p in ps:
                    d.ellipse([p[0] - 2.5, p[1] - 2.5, p[0] + 2.5, p[1] + 2.5],
                              fill=(238, 236, 224, 120))
    return img


@lru_cache(maxsize=None)
def light_leak():
    s = 1300
    yy, xx = np.mgrid[0:s, 0:s].astype(np.float32)
    dist = np.hypot(xx - s / 2, yy - s / 2) / (s / 2)
    a = np.clip(1 - dist, 0, 1) ** 2.2 * 70
    tile = np.zeros((s, s, 4), np.uint8)
    tile[..., 0], tile[..., 1], tile[..., 2] = 255, 176, 96
    tile[..., 3] = a.astype(np.uint8)
    return Image.fromarray(tile)


# ---------------------------------------------------------------- film post
@lru_cache(maxsize=None)
def _vignette():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)) / math.sqrt(2)
    return (1.0 - 0.34 * d**2.4).astype(np.float32)


WARM = np.array([1.025, 1.0, 0.94], dtype=np.float32)


def film(img, f, grain=7.0, fade=0.0):
    """Vignette + warm cast + animated grain + dust, RGBA→RGB."""
    d = ImageDraw.Draw(img, "RGBA")
    r = rng_for(("dust",), f)
    if r.random() < 0.30:
        for _ in range(r.integers(1, 4)):
            x, y = r.uniform(0, W), r.uniform(0, H)
            rad = r.uniform(1, 3.2)
            d.ellipse([x - rad, y - rad, x + rad, y + rad],
                      fill=(250, 248, 240, int(r.uniform(60, 130))))
    if r.random() < 0.05:
        x = r.uniform(0, W)
        d.line([(x, 0), (x + r.uniform(-8, 8), H)], fill=(20, 16, 12, 50), width=1)
    arr = np.asarray(img.convert("RGB"), dtype=np.float32)
    # chunky 2×2 grain: reads like 16mm and compresses far better than per-pixel
    g = np.random.default_rng(f * 977 + 13).normal(
        0, grain, (H // 2, W // 2)).astype(np.float32)
    g = g.repeat(2, axis=0).repeat(2, axis=1)[..., None]
    arr = (arr + g) * _vignette()[..., None] * WARM
    if fade > 0:
        arr *= 1.0 - min(fade, 1.0)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def camera(canvas, zoom=1.0, dx=0.0, dy=0.0, rot=0.0):
    """Zoom/shake reframe. Output pixel→input pixel affine."""
    zoom = max(zoom, 1.0 + 2.4 * (abs(dx) + abs(dy)) / W)
    cx, cy = W / 2, H / 2
    c, s = math.cos(math.radians(rot)) / zoom, math.sin(math.radians(rot)) / zoom
    a, b_, d_, e = c, -s, s, c
    cc = cx - a * cx - b_ * cy + dx
    ff = cy - d_ * cx - e * cy + dy
    return canvas.transform((W, H), Image.Transform.AFFINE,
                            (a, b_, cc, d_, e, ff),
                            resample=Image.Resampling.BILINEAR)


def shake(t, amp, rough=0.0, f=0, seed=3):
    if amp <= 0 and rough <= 0:
        return 0.0, 0.0, 0.0
    dx = amp * (math.sin(t * 11.7 + seed) + 0.5 * math.sin(t * 23.1))
    dy = amp * (math.sin(t * 13.9 + 2 + seed) + 0.5 * math.sin(t * 19.3))
    rot = amp * 0.02 * math.sin(t * 9.1 + 1)
    if rough > 0:
        r = rng_for(("rough", seed), f)
        dx += r.normal(0, rough)
        dy += r.normal(0, rough)
        rot += r.normal(0, rough * 0.012)
    return dx, dy, rot
