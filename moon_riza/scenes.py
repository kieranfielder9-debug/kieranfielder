"""The eight scenes of "the first man on the moon — riza style".

Each scene fn(tl, t, f, canvas) draws onto an RGBA canvas and returns camera
params: dict(zoom, amp, rough, leak, grain).
"""
import math
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from config import (H, MONT_BEATS, OUTRO_LINE1_T, OUTRO_LINE2_T, QUOTE_DT,
                    QUOTE_T0, QUOTE_WORDS, T_COUNT, T_DAYS, T_DESC, T_LAUNCH,
                    T_LEAP, T_MAP, T_MONT, T_OUTRO, T_QUOTE, T_TITLE, T_TV, W)
from fx import (CHALK, INK, RED, boil, card, ease_in, ease_out, font,
                hand_arrow, hand_ellipse, hand_path, marker_swipe, paper, pop,
                pop_word, put, rng_for, scribble_disc, smooth, sparkle, stamp,
                tape, text_tile, typewriter)

GOLD = (198, 160, 64, 255)
REDNOTE = (212, 84, 70, 255)


def D(c):
    return ImageDraw.Draw(c, "RGBA")


def bez(p0, p1, p2, u):
    x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u**2 * p2[0]
    y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u**2 * p2[1]
    return x, y


# ================================================================ "photos"
def _finish(img, salt=0, amt=13, tone=(1.0, 0.965, 0.89), bw=True):
    """Archival print finish: grain, tone, soft corner shading."""
    if bw:
        arr = np.asarray(img.convert("L"), dtype=np.float32)[..., None].repeat(3, 2)
    else:
        arr = np.asarray(img.convert("RGB"), dtype=np.float32)
    h, w = arr.shape[:2]
    arr += rng_for(("ph", salt)).normal(0, amt, (h, w, 1))
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2)) / math.sqrt(2)
    arr *= (1 - 0.38 * d**2.2)[..., None]
    arr *= np.array(tone, dtype=np.float32)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


@lru_cache(maxsize=None)
def photo_crew():
    img = Image.new("RGB", (400, 330), (168, 168, 170))
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([0, 0, 400, 120], fill=(190, 190, 192))
    for i, (cx, cy) in enumerate([(95, 205), (200, 175), (305, 205)]):
        d.rounded_rectangle([cx - 58, cy + 8, cx + 58, cy + 150], 26,
                            fill=(225, 224, 220))  # suit
        d.line([(cx - 30, cy + 60), (cx + 30, cy + 60)], fill=(140, 140, 140), width=5)
        d.ellipse([cx - 46, cy - 78, cx + 46, cy + 14], fill=(232, 231, 228))
        d.rounded_rectangle([cx - 32, cy - 56, cx + 32, cy - 2], 22, fill=(52, 52, 56))
        d.ellipse([cx - 24, cy - 50, cx + 6, cy - 28], fill=(110, 110, 116))
        d.rectangle([cx - 40, cy + 80, cx - 16, cy + 96], fill=(150, 60, 56))
    return _finish(img, "crew", amt=11)


@lru_cache(maxsize=None)
def photo_bootprint():
    img = Image.new("RGB", (560, 500), (128, 126, 122))
    d = ImageDraw.Draw(img, "RGBA")
    r = rng_for("boot")
    for _ in range(900):  # regolith
        x, y = r.uniform(0, 560), r.uniform(0, 500)
        g = int(r.uniform(96, 150))
        rad = r.uniform(1, 3.4)
        d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=(g, g - 2, g - 4))
    print_img = Image.new("RGBA", (560, 500))
    pd = ImageDraw.Draw(print_img)
    pd.rounded_rectangle([180, 90, 392, 430], 70, fill=(62, 60, 58, 235))
    for i in range(8):  # tread bars
        y0 = 120 + i * 38
        pd.rounded_rectangle([202, y0, 370, y0 + 22], 10, fill=(98, 95, 92, 255))
    pd.rounded_rectangle([180, 90, 392, 430], 70, outline=(160, 156, 150, 130), width=7)
    img.paste(print_img.rotate(-7, resample=Image.Resampling.BICUBIC,
                               expand=False), (0, 0), print_img.rotate(-7, expand=False))
    return _finish(img, "bootp", amt=12)


@lru_cache(maxsize=None)
def photo_flag():
    img = Image.new("RGB", (560, 500), (12, 12, 14))
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([0, 360, 560, 500], fill=(118, 115, 110))
    r = rng_for("flagground")
    for _ in range(380):
        x, y = r.uniform(0, 560), r.uniform(360, 500)
        g = int(r.uniform(86, 145))
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(g, g, g - 3))
    d.line([(352, 70), (352, 400)], fill=(225, 224, 220), width=7)  # pole
    d.line([(352, 78), (520, 78)], fill=(200, 199, 195), width=5)   # crossbar
    for i in range(7):  # stripes
        y0 = 82 + i * 22
        c = (208, 206, 202) if i % 2 == 0 else (70, 68, 66)
        d.rectangle([356, y0, 518, y0 + 22], fill=c)
        d.line([(356, y0), (518, y0)], fill=(30, 30, 30), width=1)
    d.rectangle([356, 82, 428, 148], fill=(48, 48, 54))
    rs = rng_for("flagstars")
    for _ in range(18):
        x, y = rs.uniform(360, 424), rs.uniform(86, 144)
        d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=(220, 220, 218))
    # astronaut silhouette, saluting
    cx, cy = 175, 260
    d.rounded_rectangle([cx - 40, cy - 30, cx + 40, cy + 92], 22, fill=(218, 217, 213))
    d.rounded_rectangle([cx - 56, cy - 24, cx - 30, cy + 60], 12, fill=(196, 195, 191))
    d.ellipse([cx - 32, cy - 92, cx + 32, cy - 28], fill=(226, 225, 221))
    d.rounded_rectangle([cx - 20, cy - 76, cx + 24, cy - 40], 16, fill=(58, 58, 62))
    d.line([(cx + 32, cy + 6), (cx + 70, cy - 28)], fill=(218, 217, 213), width=16)
    d.line([(cx + 64, cy - 30), (cx + 50, cy - 52)], fill=(218, 217, 213), width=13)
    for dx in (-22, 14):
        d.rounded_rectangle([cx + dx, cy + 88, cx + dx + 26, cy + 158], 10,
                            fill=(206, 205, 201))
        d.rectangle([cx + dx - 4, cy + 148, cx + dx + 32, cy + 162], fill=(190, 189, 185))
    return _finish(img, "flag", amt=14)


@lru_cache(maxsize=None)
def photo_visor():
    img = Image.new("RGB", (560, 560), (10, 10, 13))
    d = ImageDraw.Draw(img, "RGBA")
    r = rng_for("visorstars")
    for _ in range(26):
        x, y = r.uniform(0, 560), r.uniform(0, 240)
        d.ellipse([x - 1.4, y - 1.4, x + 1.4, y + 1.4], fill=(210, 210, 205, 200))
    d.rectangle([0, 430, 560, 560], fill=(105, 102, 97))
    # suit shoulders
    d.rounded_rectangle([60, 380, 500, 600], 60, fill=(212, 210, 205))
    d.line([(120, 420), (200, 470)], fill=(150, 148, 144), width=8)
    d.line([(440, 420), (360, 470)], fill=(150, 148, 144), width=8)
    d.rectangle([96, 440, 160, 490], fill=(160, 64, 58))   # patch
    d.rectangle([400, 440, 470, 490], fill=(70, 84, 130))  # patch
    # helmet + gold visor
    d.ellipse([130, 95, 430, 395], fill=(225, 223, 218))
    for i in range(60):  # radial gold gradient
        u = i / 59
        rad = 128 * (1 - u * 0.96)
        g = (int(225 - 105 * u), int(172 - 100 * u), int(60 - 38 * u))
        d.ellipse([280 - rad - 0, 245 - rad, 280 + rad, 245 + rad], fill=g)
    # reflection: horizon, LM, photographer
    d.arc([140, 250, 420, 420], 200, 340, fill=(245, 220, 160), width=6)
    d.rounded_rectangle([318, 250, 366, 286], 6, fill=(250, 230, 180))
    d.line([(322, 286), (310, 318)], fill=(250, 230, 180), width=5)
    d.line([(360, 286), (372, 318)], fill=(250, 230, 180), width=5)
    d.rounded_rectangle([216, 246, 250, 304], 14, fill=(255, 240, 200))
    d.ellipse([222, 222, 246, 246], fill=(255, 240, 200))
    d.line([(226, 304), (222, 332)], fill=(255, 240, 200), width=7)
    d.line([(242, 304), (248, 332)], fill=(255, 240, 200), width=7)
    d.ellipse([196, 130, 300, 200], fill=(255, 255, 252, 90))  # specular
    d.ellipse([180, 60, 214, 94], fill=(232, 230, 226))        # antenna nub
    return _finish(img, "visor", amt=9, bw=False, tone=(1.02, 0.99, 0.92))


@lru_cache(maxsize=None)
def rocket_sketch():
    img = Image.new("RGB", (300, 330), (236, 228, 207))
    c = img.convert("RGBA")
    d = D(c)
    cx = 150
    body = [(cx - 34, 250), (cx - 34, 110), (cx, 40), (cx + 34, 110), (cx + 34, 250)]
    d.polygon(body, fill=(246, 243, 235, 255))
    hand_path(d, body + [body[0]], INK, 6, salt="rkbody")
    hand_ellipse(d, (cx, 130), 17, color=INK, width=5, salt="rkwin")
    d.ellipse([cx - 12, 118, cx + 12, 142], fill=(140, 170, 190, 255))
    for s, dx in (("rf1", -1), ("rf2", 1)):
        fin = [(cx + dx * 34, 190), (cx + dx * 72, 262), (cx + dx * 34, 250)]
        d.polygon(fin, fill=(186, 50, 38, 255))
        hand_path(d, fin + [fin[0]], INK, 5, salt=s)
    flame = [(cx - 22, 254), (cx, 318), (cx + 22, 254)]
    d.polygon(flame, fill=(232, 140, 48, 255))
    d.polygon([(cx - 11, 254), (cx, 292), (cx + 11, 254)], fill=(248, 208, 92, 255))
    hand_path(d, [(cx - 60, 60), (cx - 80, 40)], INK, 4, salt="rs1")
    sparkle(d, (cx + 72, 64), 13, INK, 4, salt="rs2")
    sparkle(d, (cx - 86, 170), 10, INK, 4, salt="rs3")
    return _finish(c, "rk", amt=5, bw=False, tone=(1.0, 0.99, 0.96))


@lru_cache(maxsize=None)
def map_mini():
    img = Image.new("RGB", (330, 250), (25, 31, 50))
    c = img.convert("RGBA")
    d = D(c)
    r = rng_for("mmstars")
    for _ in range(40):
        x, y = r.uniform(0, 330), r.uniform(0, 250)
        d.ellipse([x - 1.3, y - 1.3, x + 1.3, y + 1.3], fill=(235, 233, 224, 190))
    d.ellipse([26, 176, 86, 236], fill=(74, 128, 196, 255))
    d.ellipse([38, 192, 60, 212], fill=(96, 150, 86, 255))
    d.ellipse([262, 30, 306, 74], fill=(206, 203, 196, 255))
    pts = [bez((58, 200), (165, 60), (284, 54), u / 22) for u in range(23)]
    for i in range(0, 22, 2):
        d.line([pts[i], pts[i + 1]], fill=(235, 233, 224, 220), width=4)
    return _finish(c, "mm", amt=6, bw=False, tone=(1, 1, 1))


# ================================================================ sprites
@lru_cache(maxsize=None)
def saturn_v():
    c = Image.new("RGBA", (210, 640))
    d = D(c)
    cx = 105
    d.rounded_rectangle([cx - 42, 78, cx + 42, 548], 10, fill=(243, 241, 233, 255))
    d.polygon([(cx - 42, 86), (cx, 16), (cx + 42, 86)], fill=(243, 241, 233, 255))
    hand_path(d, [(cx, 16), (cx, 2)], INK, 4, salt="svtow")
    d.ellipse([cx - 5, 0, cx + 5, 10], fill=INK)
    for y0, y1 in ((210, 300), (388, 401), (488, 500)):
        if y1 - y0 > 40:
            d.rectangle([cx - 42, y0, cx - 18, y1], fill=(40, 38, 36, 255))
            d.rectangle([cx + 2, y0, cx + 24, y1], fill=(40, 38, 36, 255))
        else:
            d.rectangle([cx - 42, y0, cx + 42, y1], fill=(40, 38, 36, 255))
    fl = font("anton", 30)
    for i, ch in enumerate("USA"):
        put(c, text_tile(ch, fl, (170, 40, 36, 255)), (cx, 320 + i * 32))
    d.polygon([(cx - 42, 548), (cx - 58, 600), (cx + 58, 600), (cx + 42, 548)],
              fill=(228, 225, 216, 255))
    for ddx in (-38, -13, 12, 37):
        d.ellipse([cx + ddx - 8, 598, cx + ddx + 8, 614], fill=(60, 56, 52, 255))
    for s, dx in (("svf1", -1), ("svf2", 1)):
        fin = [(cx + dx * 42, 500), (cx + dx * 78, 596), (cx + dx * 42, 560)]
        d.polygon(fin, fill=(186, 50, 38, 255))
        hand_path(d, fin + [fin[0]], INK, 4, salt=s)
    hand_path(d, [(cx - 42, 86), (cx - 42, 548), (cx - 58, 600), (cx + 58, 600),
                  (cx + 42, 548), (cx + 42, 86), (cx, 16), (cx - 42, 86)],
              INK, 5, salt="svout", jitter=1.2)
    return c


@lru_cache(maxsize=None)
def earth_sprite(r=100):
    s = int(r * 2.4)
    c = Image.new("RGBA", (s, s))
    d = D(c)
    cx = s / 2
    d.ellipse([cx - r, cx - r, cx + r, cx + r], fill=(74, 128, 196, 255))
    blobs = [(-0.32, -0.3, 0.5, 0.42), (0.3, 0.05, 0.46, 0.4), (-0.12, 0.42, 0.4, 0.3)]
    for i, (bx, by, bw, bh) in enumerate(blobs):
        d.ellipse([cx + bx * r - bw * r / 2, cx + by * r - bh * r / 2,
                   cx + bx * r + bw * r / 2, cx + by * r + bh * r / 2],
                  fill=(96, 150, 86, 255))
    d.arc([cx - r * 0.75, cx - r * 0.6, cx + r * 0.9, cx + r * 0.5], 200, 320,
          fill=(240, 244, 246, 200), width=int(r * 0.1))
    d.arc([cx - r * 0.8, cx - r * 0.1, cx + r * 0.6, cx + r * 0.9], 20, 140,
          fill=(240, 244, 246, 170), width=int(r * 0.08))
    hand_ellipse(d, (cx, cx), r, color=CHALK, width=6, salt=("esp", r), jitter=1.8)
    return c


@lru_cache(maxsize=None)
def moon_sprite(r=70, outline=CHALK):
    s = int(r * 2.4)
    c = Image.new("RGBA", (s, s))
    d = D(c)
    cx = s / 2
    d.ellipse([cx - r, cx - r, cx + r, cx + r], fill=(208, 205, 198, 255))
    rr = rng_for(("moon", r))
    for i in range(6):
        a, dist = rr.uniform(0, 6.28), rr.uniform(0.15, 0.62) * r
        crx = rr.uniform(0.12, 0.26) * r
        px, py = cx + dist * math.cos(a), cx + dist * math.sin(a)
        d.ellipse([px - crx, py - crx, px + crx, py + crx], fill=(178, 174, 166, 255))
        d.arc([px - crx, py - crx, px + crx, py + crx], 140, 330,
              fill=(150, 146, 140, 255), width=max(2, int(crx * 0.2)))
    hand_ellipse(d, (cx, cx), r, color=outline, width=6, salt=("msp", r), jitter=1.8)
    return c


@lru_cache(maxsize=None)
def lm_sprite():
    c = Image.new("RGBA", (260, 240))
    d = D(c)
    cx = 130
    oct_pts = [(cx - 75, 120), (cx - 50, 100), (cx + 50, 100), (cx + 75, 120),
               (cx + 75, 158), (cx + 50, 180), (cx - 50, 180), (cx - 75, 158)]
    d.polygon(oct_pts, fill=GOLD)
    for xx in range(cx - 70, cx + 70, 14):  # foil hatching
        d.line([(xx, 104), (xx + 10, 176)], fill=(150, 116, 40, 160), width=2)
    hand_path(d, oct_pts + [oct_pts[0]], INK, 5, salt="lmoct", jitter=1.2)
    d.rounded_rectangle([cx - 46, 38, cx + 46, 102], 14, fill=(196, 194, 188, 255))
    hand_path(d, [(cx - 46, 44), (cx - 46, 96), (cx + 46, 96), (cx + 46, 44),
                  (cx - 46, 44)], INK, 5, salt="lmtop", jitter=1.2)
    d.ellipse([cx - 32, 56, cx - 6, 82], fill=(58, 58, 64, 255))
    d.line([(cx + 20, 38), (cx + 34, 10)], fill=INK, width=4)
    d.ellipse([cx + 28, 2, cx + 44, 18], outline=INK, width=4)
    for s, dx in (("lml1", -1), ("lml2", 1)):
        hand_path(d, [(cx + dx * 60, 168), (cx + dx * 102, 218)], INK, 7, salt=s)
        d.ellipse([cx + dx * 102 - 17, 212, cx + dx * 102 + 17, 226],
                  fill=(196, 194, 188, 255), outline=(44, 38, 33, 255), width=3)
    hand_path(d, [(cx - 12, 180), (cx - 12, 214)], INK, 6, salt="lml3")
    d.ellipse([cx - 28, 210, cx + 4, 224], fill=(196, 194, 188, 255),
              outline=(44, 38, 33, 255), width=3)
    return c


@lru_cache(maxsize=None)
def capsule_sprite():
    c = Image.new("RGBA", (100, 54))
    d = D(c)
    d.polygon([(8, 27), (34, 8), (34, 46)], fill=(226, 224, 218, 255))
    d.rounded_rectangle([34, 8, 88, 46], 8, fill=(238, 236, 230, 255))
    hand_path(d, [(8, 27), (34, 8), (88, 8), (88, 46), (34, 46), (8, 27)],
              INK, 4, salt="cap", jitter=0.9)
    d.ellipse([54, 18, 72, 36], fill=(120, 150, 175, 255))
    hand_ellipse(d, (63, 27), 10, color=INK, width=3, salt="capw", jitter=0.8)
    return c


TV_SCREEN = (600, 315, 1216, 765)  # abs inner-screen rect, TV centered (960, 520)


@lru_cache(maxsize=None)
def tv_frame():
    c = Image.new("RGBA", (980, 800))
    d = D(c)
    # antenna
    for tip in ((300, 18), (660, 8)):
        hand_path(d, [(490, 130), tip], INK, 6, salt=("tvant", tip))
        d.ellipse([tip[0] - 8, tip[1] - 8, tip[0] + 8, tip[1] + 8], fill=INK)
    d.rounded_rectangle([10, 120, 970, 700], 38, fill=(206, 182, 148, 255))
    hand_path(d, [(14, 150), (14, 670), (40, 696), (940, 696), (966, 670),
                  (966, 150), (940, 124), (40, 124), (14, 150)],
              INK, 7, salt="tvbody", jitter=1.4)
    d.rounded_rectangle([116, 180, 760, 660], 48, fill=(24, 22, 26, 255))
    d.rounded_rectangle([130, 195, 746, 645], 40, fill=(8, 8, 10, 255))
    for cy, s in ((260, "tvk1"), (370, "tvk2")):
        d.ellipse([810, cy - 30, 870, cy + 30], fill=(96, 76, 56, 255))
        hand_ellipse(d, (840, cy), 30, color=INK, width=5, salt=s, jitter=1.0)
        hand_path(d, [(840, cy), (858, cy - 16)], INK, 4, salt=(s, "p"))
    for i in range(5):
        d.line([(800, 450 + i * 34), (884, 450 + i * 34)], fill=(120, 96, 70, 255),
               width=8)
    for s, x0, x1 in (("tvl1", 120, 60), ("tvl2", 860, 920)):
        hand_path(d, [(x0, 700), (x1, 790)], INK, 8, salt=s)
    return c


@lru_cache(maxsize=None)
def _scanlines(w, h):
    arr = np.zeros((h, w, 4), np.uint8)
    arr[::3, :, 3] = 64
    return Image.fromarray(arr)


@lru_cache(maxsize=None)
def _screen_mask(w, h):
    m = Image.new("L", (w, h))
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], 36, fill=255)
    return m


def tv_static(tl, f):
    """The ghostly live broadcast: noise + blurry ladder figure."""
    x0, y0, x1, y1 = TV_SCREEN
    w, h = x1 - x0, y1 - y0
    r = np.random.default_rng(f * 31 + 7)
    noise = r.integers(14, 120, (h // 3, w // 3), np.uint8)
    base = Image.fromarray(noise, "L").resize((w, h), Image.Resampling.NEAREST)
    ghost = Image.new("L", (w, h), 0)
    g = ImageDraw.Draw(ghost)
    g.rectangle([0, int(h * 0.78), w, h], fill=150)                    # ground
    g.line([(w * 0.96, h * 0.02), (w * 0.60, h * 0.78)], fill=190, width=26)
    g.line([(w * 0.40, h * 0.10), (w * 0.40, h * 0.80)], fill=205, width=15)
    for i in range(6):
        yy = h * (0.16 + i * 0.105)
        g.line([(w * 0.33, yy), (w * 0.47, yy)], fill=185, width=9)
    u = smooth((tl - 0.5) / 2.3)                                       # the descent
    fy = h * (0.18 + 0.42 * u)
    g.ellipse([w * 0.40 - 26, fy - 34, w * 0.40 + 30, fy + 30], fill=235)
    g.rounded_rectangle([w * 0.40 - 44, fy - 18, w * 0.40 - 14, fy + 38], 10, fill=215)
    g.line([(w * 0.40 + 6, fy + 26), (w * 0.40 + 14, fy + 74)], fill=235, width=16)
    g.rounded_rectangle([w * 0.40 - 2, fy + 66, w * 0.40 + 34, fy + 88], 8, fill=250)
    g.ellipse([w * 0.04, h * 0.04, w * 0.30, h * 0.22], fill=110)      # glare
    ghost = ghost.filter(ImageFilter.GaussianBlur(4))
    comp = Image.composite(Image.new("L", (w, h), 255), base,
                           ghost.point(lambda v: min(255, int(v * 1.1))))
    comp = Image.blend(base, comp, 0.82).convert("RGBA")
    comp.alpha_composite(_scanlines(w, h))
    if r.random() < 0.10:  # analog hiccup: one bright row band
        yy = int(r.uniform(0, h - 8))
        ImageDraw.Draw(comp).rectangle([0, yy, w, yy + 5], fill=(220, 220, 215, 90))
    comp.putalpha(_screen_mask(w, h))
    return comp


# ================================================================ scenes
def sc_title(tl, t, f, c):
    c.alpha_composite(paper("cream"))
    d = D(c)
    b = boil(f)
    put(c, stamp("JULY 16, 1969", 54), (430, 168), angle=-4,
        scale=pop(tl - 0.45) or 0)
    typewriter(c, (215, 262), "cape kennedy, florida — 9:32 am",
               font("specialelite", 42), tl - 0.9, 18, INK, f)
    pop_word(c, "the day", font("caveat", 150), (740, 430), tl - 1.6, angle=-2)
    pop_word(c, "we left", font("caveat", 150), (790, 580), tl - 2.1, angle=1.5)
    pop_word(c, "EARTH", font("anton", 230), (900, 790), tl - 2.6)
    if tl > 3.0:
        hand_ellipse(d, (905, 800), 365, 155, color=INK, width=9, salt="tcirc",
                     b=b, progress=(tl - 3.0) / 0.65)
    if tl > 3.5:
        sparkle(d, (1300, 660), 18, INK, 5, salt="ts1", b=b)
        sparkle(d, (540, 900), 13, INK, 4, salt="ts2", b=b)
    s = pop(tl - 2.95)
    if s:
        put(c, card(rocket_sketch(), "soon."), (1590, 760), angle=7, scale=0.9 * s)
        if tl > 3.25:
            tape(c, (1530, 570), angle=55)
    if tl > 3.3:
        put(c, moon_sprite(55, outline=INK), (1700, 200),
            alpha=int(255 * smooth((tl - 3.3) / 0.5)))
    return dict(zoom=1.0 + 0.035 * smooth(tl / 4.2), amp=0, rough=0, leak=0.6,
                grain=7)


def sc_count(tl, t, f, c):
    c.alpha_composite(paper("cream"))
    d = D(c)
    b = boil(f)
    idx = min(2, int(tl / 0.7))
    tp = tl - idx * 0.7
    digit = "321"[idx]
    put(c, text_tile("T-MINUS", font("specialelite", 52), INK), (960, 160))
    s = pop(tp, 0.26)
    if s:
        put(c, text_tile(digit, font("anton", 520), INK), (960, 540), scale=s)
    hand_ellipse(d, (960, 540), 360, color=INK, width=10, salt=("cring", idx),
                 b=b, progress=tp / 0.5)
    for k in range(12):
        a = k * math.pi / 6
        p0 = (960 + 400 * math.cos(a), 540 + 400 * math.sin(a))
        p1 = (960 + 432 * math.cos(a), 540 + 432 * math.sin(a))
        if tp > 0.3 + k * 0.012:
            hand_path(d, [p0, p1], INK, 6, salt=("ctick", idx, k), b=b)
    typewriter(c, (215, 955), "ignition sequence start",
               font("specialelite", 40), t - 4.35, 24, INK, f)
    return dict(zoom=1.0 + 0.10 * (1 - ease_out(tp / 0.35)), amp=0, rough=2,
                leak=0, grain=7)


def sc_launch(tl, t, f, c):
    c.alpha_composite(paper("cream"))
    d = D(c)
    b = boil(f)
    hand_path(d, [(60, 935), (1860, 930)], INK, 8, salt="ground", b=b)
    # gantry tower
    for s, seg in (("tw1", [(1330, 930), (1330, 620)]),
                   ("tw2", [(1390, 930), (1390, 660)]),
                   ("tw3", [(1330, 700), (1390, 700)]),
                   ("tw4", [(1330, 790), (1390, 790)]),
                   ("tw5", [(1330, 880), (1390, 880)]),
                   ("tw6", [(1330, 660), (1390, 700)])):
        hand_path(d, seg, INK, 6, salt=s, b=b)
    # smoke puffs accumulate at pad
    r0 = rng_for("smoke")
    offs = [(r0.uniform(-1, 1), r0.uniform(0.5, 1)) for _ in range(26)]
    for k in range(26):
        st = k * 0.11
        age = tl - st
        if 0 < age < 2.4:
            ox, oy = offs[k]
            px = 1140 + ox * (50 + age * 90)
            py = 915 - oy * age * 26
            rad = 30 + age * 52
            al = max(0.0, 1 - age / 2.4)
            d.ellipse([px - rad, py - rad * 0.8, px + rad, py + rad * 0.8],
                      fill=(196, 190, 180, int(120 * al)))
            scribble_disc(d, (px, py), rad * 0.8, (150, 144, 134, int(180 * al)),
                          salt=("smk", k), b=b, turns=3, width=6)
    # the rocket
    yc = 600 - 1250 * ease_in(tl / 3.4)
    if yc > -420:
        if tl > 0.05:
            r = rng_for("flame", b)
            fl = r.uniform(90, 150)
            fx_ = 1140
            fy = yc + 318
            d.polygon([(fx_ - 30, fy), (fx_, fy + fl), (fx_ + 30, fy)],
                      fill=(232, 130, 44, 235))
            d.polygon([(fx_ - 15, fy), (fx_, fy + fl * 0.6), (fx_ + 15, fy)],
                      fill=(248, 210, 96, 245))
        put(c, saturn_v(), (1140, yc))
        if tl > 0.6:  # speed lines
            for k, (sx, sy) in enumerate([(1040, 60), (1248, 110), (1010, 260),
                                          (1268, 320)]):
                hand_path(d, [(sx, yc + sy), (sx, yc + sy + 90)], (44, 38, 33, 130),
                          4, salt=("spd", k), b=b)
    pop_word(c, "LIFTOFF!", font("anton", 170), (430, 280), tl - 0.15, angle=-5)
    marker_swipe(c, (430, 348), 560, tl - 0.5)
    if pop(tl - 1.3):
        pop_word(c, "7.5 million lbs", font("caveat", 64), (1580, 420), tl - 1.3,
                 angle=4)
        pop_word(c, "of thrust", font("caveat", 64), (1610, 490), tl - 1.38,
                 angle=4)
        hand_arrow(d, (1480, 540), (1265, 560), INK, 6, salt="thar", b=b,
                   progress=(tl - 1.6) / 0.5)
    # cream → space as we climb
    atop = smooth((tl - 2.1) / 2.0)
    if atop > 0:
        grad = _sky_grad()
        gar = np.array(grad)
        gar[..., 3] = (gar[..., 3] * atop).astype(np.uint8)
        c.alpha_composite(Image.fromarray(gar))
        rs = rng_for("lstars")
        for k in range(34):
            x, y = rs.uniform(0, W), rs.uniform(0, 520)
            al = int(200 * max(0.0, atop - 0.4) / 0.6)
            if al > 0:
                d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(238, 236, 224, al))
    amp = 11 * math.exp(-tl / 1.9)
    return dict(zoom=1.035 + 0.02 * smooth(tl / 4.2), amp=amp,
                rough=6 * math.exp(-tl / 1.5), leak=0.35, grain=7)


@lru_cache(maxsize=None)
def _sky_grad():
    a = np.zeros((H, W, 4), np.uint8)
    a[..., 0], a[..., 1], a[..., 2] = 25, 31, 50
    fall = np.clip(np.linspace(1.35, -0.25, H), 0, 1) ** 1.4
    a[..., 3] = (fall * 255)[:, None].astype(np.uint8)
    return Image.fromarray(a)


def sc_map(tl, t, f, c):
    c.alpha_composite(paper("navy"))
    d = D(c)
    b = boil(f)
    pop_word(c, "the longest road trip", font("caveat", 70), (960, 140), tl - 0.8,
             CHALK, angle=-2)
    put(c, earth_sprite(100), (300, 840), scale=min(1.0, pop(tl + 0.25) or 1))
    put(c, moon_sprite(70), (1640, 230))
    put(c, text_tile("home", font("caveat", 44), CHALK), (300, 985))
    put(c, text_tile("the moon", font("caveat", 44), CHALK), (1640, 340))
    # dashed trajectory
    p0, p1, p2 = (430, 760), (940, 300), (1545, 300)
    pts = [bez(p0, p1, p2, u / 120) for u in range(121)]
    pr = min(1.0, max(0.0, (tl - 0.5) / 4.0))
    k = int(len(pts) * pr)
    for i in range(0, max(0, k - 1), 6):
        seg = pts[i:i + 4]
        if len(seg) >= 2:
            hand_path(d, seg, (235, 233, 224, 225), 7, salt=("dash", i), b=b,
                      jitter=1.0)
    if 0.02 < pr:
        x, y = pts[min(k, 120)]
        nx, ny = pts[min(k + 2, 120)]
        ang = -math.degrees(math.atan2(ny - y, nx - x))
        wob = 4 * math.sin(t * 9)
        put(c, capsule_sprite(), (x, y + wob), angle=ang)
    pop_word(c, "238,855 miles", font("caveat", 60), (940, 600), tl - 1.6, CHALK,
             angle=-3)
    if tl > 1.85:
        hand_arrow(d, (965, 545), (985, 460), CHALK, 5, salt="mar", b=b,
                   progress=(tl - 1.85) / 0.45)
    pop_word(c, "24,000 mph", font("caveat", 54), (1330, 500), tl - 2.8, CHALK,
             angle=2)
    s = pop(tl - 3.5)
    if s:
        put(c, card(photo_crew(), "the crew"), (330, 300), angle=-6, scale=0.85 * s)
        if tl > 3.8:
            tape(c, (330, 128), angle=8)
    pop_word(c, "just three guys in a tin can", font("caveat", 56), (700, 415),
             tl - 4.1, CHALK, angle=2)
    return dict(zoom=1.02 + 0.05 * smooth(tl / 6.5), amp=0, rough=0, leak=0,
                grain=7)


def sc_days(tl, t, f, c):
    c.alpha_composite(paper("cream"))
    d = D(c)
    b = boil(f)
    tape(c, (190, 130), angle=35)
    tape(c, (1730, 950), angle=28)
    pop_word(c, "four days later...", font("caveat", 150), (960, 460), tl - 0.25,
             angle=-1.5)
    fnt = font("specialelite", 40)
    txt = "(quietly hurtling through the void)"
    typewriter(c, (960 - fnt.getlength(txt) / 2, 640), txt, fnt, t - 17.8, 22,
               INK, f)
    if tl > 0.7:
        sparkle(d, (430, 330), 16, INK, 5, salt="dsp1", b=b)
        sparkle(d, (1490, 560), 13, INK, 4, salt="dsp2", b=b)
    return dict(zoom=1.0 + 0.03 * tl / 2.3, amp=0, rough=0, leak=0.25, grain=7)


@lru_cache(maxsize=None)
def _desc_moon():
    c = Image.new("RGBA", (W, H))
    d = D(c)
    d.ellipse([960 - 1750, 2560 - 1750, 960 + 1750, 2560 + 1750],
              fill=(176, 173, 166, 255))
    r = rng_for("descmoon")
    for i in range(11):
        px = 140 + i * 165 + r.uniform(-40, 40)
        py = 2560 - math.sqrt(max(0, 1750**2 - (px - 960) ** 2)) + r.uniform(30, 150)
        crx = r.uniform(22, 60)
        d.ellipse([px - crx, py - crx * 0.6, px + crx, py + crx * 0.6],
                  fill=(157, 154, 147, 255))
        d.arc([px - crx, py - crx * 0.6, px + crx, py + crx * 0.6], 150, 340,
              fill=(140, 137, 131, 255), width=5)
    return c


def sc_desc(tl, t, f, c):
    c.alpha_composite(paper("navy"))
    c.alpha_composite(_desc_moon())
    d = D(c)
    b = boil(f)
    u = smooth(min(1.0, tl / 5.7))
    yc = 240 + 440 * u
    sway = 26 * math.sin(t * 1.8) * (1 - u)
    lx = 1150 + sway
    if tl < 5.65:
        r = rng_for("lmflame", b)
        fl = r.uniform(36, 70)
        d.polygon([(lx - 18, yc + 112), (lx, yc + 112 + fl), (lx + 18, yc + 112)],
                  fill=(232, 140, 48, 230))
        d.ellipse([lx - 26, yc + 104, lx + 26, yc + 126], fill=(248, 210, 96, 90))
    put(c, lm_sprite(), (lx, yc))
    if 5.7 < tl < 7.4:  # touchdown dust
        age = tl - 5.7
        for sgn in (-1, 1):
            px = 1150 + sgn * (60 + age * 260)
            al = max(0.0, 1 - age / 1.7)
            scribble_disc(d, (px, 850), 26 + age * 50,
                          (200, 196, 188, int(170 * al)), salt=("dust", sgn),
                          b=b, turns=3, width=6)
    if tl > 1.3:
        jx = jy = 0.0
        if tl < 2.9:
            rj = rng_for("alarmj", f)
            jx, jy = rj.uniform(-4, 4), rj.uniform(-3, 3)
        put(c, stamp("MASTER ALARM · 1202", 40), (410 + jx, 210 + jy), angle=-3,
            scale=pop(tl - 1.3) or 0)
    # fuel gauge
    hand_path(d, [(1600, 310), (1600, 640), (1696, 640), (1696, 310), (1600, 310)],
              CHALK, 7, salt="fuelbox", b=b)
    frac = 1 - 0.92 * min(1.0, max(0.0, (tl - 2.2) / 3.0))
    col = (120, 200, 130, 220) if frac > 0.45 else \
          (235, 170, 60, 220) if frac > 0.22 else (225, 70, 56, 230)
    d.rectangle([1612, 640 - 318 * frac, 1684, 632], fill=col)
    for i in range(5):
        d.line([(1600, 320 + i * 64), (1622, 320 + i * 64)], fill=CHALK, width=4)
    put(c, text_tile("fuel", font("caveat", 46), CHALK), (1648, 692))
    if tl > 3.7:
        rj = rng_for("fnote", b)
        pop_word(c, "30 seconds!!", font("caveat", 64), (1500 + rj.uniform(-2, 2),
                 770 + rj.uniform(-2, 2)), tl - 3.7, REDNOTE, angle=-5)
    typewriter(c, (215, 955), "» eagle, you're go for landing",
               font("specialelite", 38), t - 21.0, 22, CHALK, f)
    if 5.7 < tl < 6.0:
        d.rectangle([0, 0, W, H], fill=(255, 252, 244, int(210 * (1 - (tl - 5.7) / 0.3))))
    pop_word(c, "THE EAGLE", font("anton", 150), (960, 400), tl - 6.05, CHALK)
    pop_word(c, "HAS LANDED.", font("anton", 150), (960, 565), tl - 6.3, CHALK)
    pop_word(c, "(with ~25 seconds of fuel to spare)", font("caveat", 52),
             (960, 705), tl - 7.0, CHALK)
    amp = 2 + (4 * math.exp(-(tl - 1.3) * 1.8) if tl > 1.3 else 0)
    if tl > 5.7:
        amp = 0.6
    return dict(zoom=1.03, amp=amp, rough=1.5 if tl < 5.7 else 0.3, leak=0,
                grain=7)


def sc_tv(tl, t, f, c):
    c.alpha_composite(paper("dark"))
    d = D(c)
    put(c, tv_frame(), (960, 520))
    c.alpha_composite(tv_static(tl, f), (TV_SCREEN[0], TV_SCREEN[1]))
    if (f // 16) % 2 == 0:
        d.ellipse([1146, 348, 1170, 372], fill=(225, 60, 48, 255))
        put(c, text_tile("LIVE", font("specialelite", 34), (225, 60, 48, 255)),
            (1102, 359))
    fnt = font("specialelite", 40)
    t1 = "july 20, 1969 — 10:56 pm edt"
    t2 = "watching live: 600,000,000 people"
    typewriter(c, (960 - fnt.getlength(t1) / 2, 930), t1, fnt, t - 27.8, 16,
               CHALK, f)
    typewriter(c, (960 - fnt.getlength(t2) / 2, 990), t2, fnt, t - 29.2, 20,
               CHALK, f)
    return dict(zoom=1.0 + 0.012 * smooth(tl / 3.6), amp=0, rough=0.7, leak=0,
                grain=9)


def sc_quote(tl, t, f, c):
    c.alpha_composite(paper("cream"))
    put(c, moon_sprite(50, outline=INK), (1720, 170))
    fnt = font("caveat", 130)
    spots = [(560, 420, -2.5), (880, 405, 1.5), (1215, 425, -1.5),
             (600, 645, 2.0), (850, 660, -2.0), (1175, 640, 1.0)]
    for i, wd in enumerate(QUOTE_WORDS):
        x, y, a = spots[i]
        pop_word(c, wd, fnt, (x, y), t - (QUOTE_T0 + i * QUOTE_DT), angle=a)
    return dict(zoom=1.0 + 0.035 * smooth(tl / 2.4), amp=0, rough=0, leak=0.25,
                grain=6)


def sc_leap(tl, t, f, c):
    c.alpha_composite(paper("navy"))
    d = D(c)
    b = boil(f)
    marker_swipe(c, (960, 575), 880, tl - 0.6, h=86)
    pop_word(c, "ONE GIANT", font("anton", 175), (960, 290), tl - 0.0, CHALK)
    pop_word(c, "LEAP", font("anton", 360), (960, 560), tl - 0.35, CHALK)
    pop_word(c, "FOR MANKIND", font("anton", 140), (960, 845), tl - 1.2, CHALK)
    if tl > 0.4:  # confetti sparkles
        rr = rng_for("conf")
        for k in range(16):
            ang = k / 16 * 2 * math.pi + rr.uniform(-0.2, 0.2)
            life = (tl - 0.4) / 1.1
            if life < 1:
                rad = 240 + 460 * ease_out(life)
                px = 960 + rad * math.cos(ang) * 1.35
                py = 560 + rad * math.sin(ang) * 0.75
                cols = [CHALK, (255, 208, 56, 255), (225, 90, 70, 255)]
                sparkle(d, (px, py), int(20 * (1 - life * 0.5)),
                        cols[k % 3][:3] + (int(255 * (1 - life)),),
                        4, salt=("cf", k), b=b)
    zoom = 1.04
    for hit in (0.0, 0.35, 1.2):
        if tl > hit:
            zoom += 0.05 * math.exp(-(tl - hit) * 6)
    return dict(zoom=zoom, amp=0, rough=0, leak=0, grain=7)


MONT = [
    dict(photo=photo_bootprint, cap="the first footprint", angle=-3.5,
         note=("no wind. no rain.", "it's still up there."), npos=(360, 300),
         nang=-4, arrow=((470, 420), (660, 520)),
         stamp_txt="47.5 LBS OF MOON ROCKS", spos=(1470, 880), sang=6),
    dict(photo=photo_flag, cap="old glory, sea of tranquility", angle=3.0,
         note=("an off-the-shelf flag —", "about $5.50"), npos=(1510, 290),
         nang=3, arrow=((1390, 380), (1150, 440)),
         stamp_txt="21.5 HRS ON THE MOON", spos=(420, 880), sang=-5),
    dict(photo=photo_visor, cap="buzz — photographed by neil", angle=-2.5,
         note=("neil held the camera, so the", "moon's photos are mostly buzz"),
         npos=(380, 300), nang=-3, arrow=((520, 420), (700, 510)),
         stamp_txt="EVA: 2 HRS 31 MIN", spos=(1500, 880), sang=4),
]


def sc_mont(tl, t, f, c):
    c.alpha_composite(paper("cream"))
    d = D(c)
    b = boil(f)
    i = min(2, int(tl / 3.0))
    tb = tl - i * 3.0
    spec = MONT[i]
    s = pop(tb - 0.15, 0.32)
    if s:
        put(c, card(spec["photo"](), spec["cap"], cap_size=52), (960, 510),
            angle=spec["angle"], scale=min(1.0, s))
        if tb > 0.5:
            tape(c, (960 + (60 if i % 2 else -50), 165), angle=12 if i % 2 else -9)
    fnt = font("caveat", 58)
    pop_word(c, spec["note"][0], fnt, spec["npos"], tb - 0.8, angle=spec["nang"])
    pop_word(c, spec["note"][1], fnt,
             (spec["npos"][0] + 18, spec["npos"][1] + 64), tb - 0.92,
             angle=spec["nang"])
    if tb > 1.15:
        hand_arrow(d, *spec["arrow"], color=INK, width=6, salt=("mar", i), b=b,
                   progress=(tb - 1.15) / 0.5)
    if tb > 1.4:
        put(c, stamp(spec["stamp_txt"], 38), spec["spos"], angle=spec["sang"],
            scale=(pop(tb - 1.4, 0.26) or 0) * 0.95)
    zoom = 1.0 + 0.10 * (1 - ease_out(tb / 0.5)) + 0.045 * smooth(tb / 3.0)
    return dict(zoom=zoom, amp=0, rough=0, leak=0.18, grain=7)


def sc_outro(tl, t, f, c):
    c.alpha_composite(paper("cream"))
    d = D(c)
    b = boil(f)
    minis = [
        (card(photo_bootprint(), "the footprint", cap_size=64), 0.46, (390, 330),
         -7, 0.2),
        (card(photo_flag(), "the flag", cap_size=64), 0.46, (950, 290), 4, 0.45),
        (card(photo_visor(), "buzz", cap_size=64), 0.46, (1505, 340), -4, 0.7),
        (card(rocket_sketch(), "how it started"), 0.72, (250, 800), 6, 0.95),
        (card(map_mini(), "238,855 mi"), 0.78, (1665, 800), -6, 1.15),
    ]
    for tile, sc, pos, ang, dt in minis:
        s = pop(tl - 0.2 - dt, 0.3)
        if s:
            put(c, tile, pos, angle=ang, scale=sc * min(1.0, s))
            if tl > 0.55 + dt:
                tape(c, (pos[0], pos[1] - int(150 * sc / 0.46)), angle=ang + 40,
                     w=130, h=38)
    put(c, stamp("APOLLO 11 · JULY 1969", 40), (960, 96), angle=-2,
        scale=pop(tl - 1.6, 0.28) or 0)
    # the closing lines, word by word
    fnt = font("caveat", 104)
    for (line, t0, y) in (("we went to the moon.", OUTRO_LINE1_T, 620),
                          ("...and it was beautiful.", OUTRO_LINE2_T, 745)):
        words = line.split(" ")
        widths = [fnt.getlength(wd + " ") for wd in words]
        x = 960 - sum(widths) / 2
        for j, wd in enumerate(words):
            pop_word(c, wd, fnt, (x + widths[j] / 2, y), t - (t0 + j * 0.25),
                     angle=(-1.2, 1.0)[j % 2])
            x += widths[j]
    fnt2 = font("specialelite", 36)
    txt = "this edit was generated entirely by code"
    typewriter(c, (960 - fnt2.getlength(txt) / 2, 945), txt, fnt2, t - 49.4, 22,
               INK, f)
    put(c, stamp("FIN.", 64), (1495, 940), angle=-8, scale=pop(t - 50.6, 0.3) or 0)
    return dict(zoom=1.07 - 0.07 * smooth(tl / 1.4), amp=0, rough=0, leak=0.5,
                grain=7)


SCENES = [
    (T_TITLE, sc_title), (T_COUNT, sc_count), (T_LAUNCH, sc_launch),
    (T_MAP, sc_map), (T_DAYS, sc_days), (T_DESC, sc_desc), (T_TV, sc_tv),
    (T_QUOTE, sc_quote), (T_LEAP, sc_leap), (T_MONT, sc_mont),
    (T_OUTRO, sc_outro),
]
