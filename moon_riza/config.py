"""Shared timeline + paths for "the first man on the moon — riza style"."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUT = ROOT / "output"

W, H = 1920, 1080
FPS = 30
SEED = 11

# scene start times (seconds)
T_TITLE = 0.0
T_COUNT = 4.2
T_LAUNCH = 6.3
T_MAP = 10.5
T_DAYS = 17.0
T_DESC = 19.3
T_TV = 27.0
T_QUOTE = 30.6
T_LEAP = 33.0
T_MONT = 36.0
T_OUTRO = 45.0
T_END = 52.5

MONT_BEATS = (36.0, 39.0, 42.0)

# typewriter captions: (text, t0, chars/sec) — audio lays a key click per char
TYPED = [
    ("cape kennedy, florida — 9:32 am", 0.9, 18),
    ("ignition sequence start", 4.35, 24),
    ("(quietly hurtling through the void)", 17.8, 22),
    ("» eagle, you're go for landing", 21.0, 22),
    ("july 20, 1969 — 10:56 pm edt", 27.8, 16),
    ("watching live: 600,000,000 people", 29.2, 20),
    ("this edit was generated entirely by code", 49.4, 22),
]

QUOTE_WORDS = ["“that's", "one", "small", "step", "for", "man...”"]
QUOTE_T0, QUOTE_DT = 30.85, 0.34

LEAP_HITS = (33.0, 33.35, 34.2)      # ONE GIANT / LEAP / FOR MANKIND
WHOOSH_T = (10.5, 17.0, 19.3, 27.0, 36.0, 39.0, 42.0, 45.0)
QUINDAR_T = (19.6, 25.45, 27.25, 30.5, 51.7)
BLIP_T = (4.25, 4.95, 5.65)

# kinetic word "pops" that get a thunk in the audio
POP_T = (1.6, 2.1, 2.6, 6.45, 11.3, 12.1, 13.3, 14.0, 14.6, 17.25,
         25.35, 25.6, 26.3, 36.15, 36.95, 37.55, 39.15, 39.95, 40.55,
         42.15, 42.95, 43.55, 46.6, 50.6)
OUTRO_LINE1_T, OUTRO_LINE1_N = 45.8, 5    # "we went to the moon."
OUTRO_LINE2_T, OUTRO_LINE2_N = 47.6, 4    # "...and it was beautiful."
