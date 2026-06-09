"""Fully synthesized soundtrack — lo-fi pad, dusty beat, quindar beeps.

Every cue time comes from config so sound stays locked to picture.
"""
import wave

import numpy as np

from config import (BLIP_T, LEAP_HITS, MONT_BEATS, OUTRO_LINE1_N,
                    OUTRO_LINE1_T, OUTRO_LINE2_N, OUTRO_LINE2_T, POP_T,
                    QUINDAR_T, QUOTE_DT, QUOTE_T0, QUOTE_WORDS, T_END, TYPED,
                    WHOOSH_T)

SR = 44100
RNG = np.random.default_rng(42)


def _n(dur):
    return int(dur * SR)


def _t(dur):
    return np.arange(_n(dur), dtype=np.float32) / SR


def add(buf, t0, x, gain=1.0):
    i = int(t0 * SR)
    if i >= len(buf) or i + len(x) <= 0:
        return
    j = min(len(buf), i + len(x))
    buf[max(i, 0):j] += (x[:j - max(i, 0)] if i >= 0 else x[-i:j - i]) * gain


def env_ad(dur, a=0.01, curve=6.0):
    t = _t(dur)
    e = np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-t * curve)
    return e.astype(np.float32)


def sine(freq, dur, phase=0.0):
    return np.sin(2 * np.pi * freq * _t(dur) + phase).astype(np.float32)


def kick(deep=False):
    dur = 0.35 if not deep else 0.8
    t = _t(dur)
    f0, f1 = (115, 42) if not deep else (90, 30)
    freq = f1 + (f0 - f1) * np.exp(-t * 18)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    return (np.sin(ph) * np.exp(-t * (16 if not deep else 5))).astype(np.float32)


def snare():
    dur = 0.16
    n = RNG.normal(0, 1, _n(dur)).astype(np.float32)
    n = np.diff(n, prepend=0) * 0.6 + n * 0.25  # brighten
    return n * env_ad(dur, 0.002, 22) + sine(190, dur) * env_ad(dur, 0.002, 40) * 0.5


def hat():
    dur = 0.05
    n = RNG.normal(0, 1, _n(dur)).astype(np.float32)
    return np.diff(n, prepend=0) * env_ad(dur, 0.001, 70)


def quindar():
    return sine(2475, 0.25) * env_ad(0.25, 0.004, 9) * 0.9


def blip():
    x = sine(880, 0.09) + 0.3 * sine(2640, 0.09)
    return x * env_ad(0.09, 0.003, 30)


def click():
    dur = 0.025
    n = RNG.normal(0, 1, _n(dur)).astype(np.float32)
    return np.diff(n, prepend=0) * env_ad(dur, 0.0008, 120) + \
        sine(3400, dur) * env_ad(dur, 0.0008, 160) * 0.3


def thunk(freq=95.0):
    x = sine(freq, 0.1) * env_ad(0.1, 0.002, 38)
    c = click()
    x[:len(c)] += c * 0.4
    return x


def whoosh(dur=0.45):
    n = RNG.normal(0, 1, _n(dur)).astype(np.float32)
    k = 24
    n = np.convolve(n, np.ones(k, np.float32) / k, "same")  # darken
    t = np.linspace(0, 1, len(n)).astype(np.float32)
    return n * (np.sin(np.pi * t) ** 2) * 3.0


def alarm_buzz():
    dur = 0.42
    x = (np.sign(sine(620, dur)) * 0.6 + sine(620, dur) * 0.4).astype(np.float32)
    trem = 0.5 + 0.5 * sine(9, dur)
    return x * trem * env_ad(dur, 0.01, 4) * 0.5


def chord_pad(total):
    """Warm detuned pad cycling Am – F – C – G, stereo."""
    chords = [(110.0, 164.81, 220.0, 261.63, 329.63),
              (87.31, 174.61, 220.0, 261.63, 349.23),
              (130.81, 196.0, 261.63, 329.63, 392.0),
              (98.0, 146.83, 196.0, 246.94, 293.66)]
    seg = 3.2
    L = np.zeros(_n(total), np.float32)
    R = np.zeros(_n(total), np.float32)
    i = 0
    t0 = 0.0
    while t0 < total:
        freqs = chords[i % 4]
        dur = min(seg + 0.6, total - t0)
        t = _t(dur)
        e = np.minimum(t / 0.5, 1.0) * np.minimum((dur - t) / 0.6, 1.0)
        e = np.clip(e, 0, 1) ** 1.5
        wob = 1.0 + 0.0022 * np.sin(2 * np.pi * 0.4 * (t + t0))
        for ch, det in ((L, 0.9988), (R, 1.0012)):
            x = np.zeros(len(t), np.float32)
            for k, fq in enumerate(freqs):
                amp = (0.5 if k == 0 else 0.3) / (1 + k * 0.25)
                x += amp * np.sin(2 * np.pi * fq * det * wob * t).astype(np.float32)
                x += amp * 0.22 * np.sin(2 * np.pi * fq * 2 * det * t).astype(np.float32)
            add(ch, t0, x * e)
        t0 += seg
        i += 1
    return L, R


def vinyl(total):
    n = _n(total)
    hiss = RNG.normal(0, 1, n).astype(np.float32)
    hiss = np.convolve(hiss, np.ones(8, np.float32) / 8, "same") * 0.012
    out = hiss
    n_pops = int(total * 5)
    for _ in range(n_pops):
        i = RNG.integers(0, n - 400)
        ln = RNG.integers(40, 320)
        burst = RNG.normal(0, 1, ln).astype(np.float32)
        burst *= np.exp(-np.linspace(0, 7, ln)).astype(np.float32)
        out[i:i + ln] += burst * RNG.uniform(0.02, 0.10)
    return out


def rumble(dur=5.4):
    n = _n(dur)
    w = np.cumsum(RNG.normal(0, 1, n)).astype(np.float32)
    w -= np.convolve(w, np.ones(2400, np.float32) / 2400, "same")  # de-drift
    w /= max(1e-6, np.abs(w).max())
    t = _t(dur)
    e = np.clip(t / 0.5, 0, 1) * np.exp(-np.clip(t - 2.4, 0, None) * 0.9)
    sub = np.sin(2 * np.pi * 36 * t * (1 + 0.1 * np.sin(2 * np.pi * 0.7 * t)))
    return (w * 0.8 + sub.astype(np.float32) * 0.45) * e


def riser(dur=1.2):
    n = RNG.normal(0, 1, _n(dur)).astype(np.float32)
    t = np.linspace(0, 1, len(n)).astype(np.float32)
    sweep = np.sin(2 * np.pi * (260 + 640 * t**2) * _t(dur)).astype(np.float32)
    return (n * 0.7 + sweep * 0.25) * t**2.2


def gain_env(total, points):
    """Piecewise-linear gain over time: [(t, gain), ...]."""
    t = np.arange(_n(total), dtype=np.float32) / SR
    return np.interp(t, [p[0] for p in points],
                     [p[1] for p in points]).astype(np.float32)


def build(path):
    total = T_END
    n = _n(total)
    M = np.zeros(n, np.float32)  # mono events

    # --- bed
    padL, padR = chord_pad(total)
    pad_g = gain_env(total, [(0, 0), (1.5, 1), (26.9, 1), (27.5, 0.30),
                             (32.6, 0.30), (33.0, 1.3), (45, 1.05), (48, 0.8),
                             (51.4, 0.05), (total, 0)]) * 0.16
    padL *= pad_g
    padR *= pad_g
    crackle = vinyl(total)

    # --- beat (75 bpm, drops out for the quiet step, slams back at the leap)
    beat = 0.8
    dead = lambda x: 25.0 < x < 33.0
    bar = 10.6
    while bar < 45.2:
        for off, g in ((0.0, 1.0), (1.8, 0.9)):
            if not dead(bar + off) and bar + off < 44.6:
                add(M, bar + off, kick(), 0.5 * g)
        for off in (0.8, 2.4):
            if not dead(bar + off) and bar + off < 44.6:
                add(M, bar + off, snare(), 0.26)
        for k in range(8):
            off = k * 0.4
            if not dead(bar + off) and bar + off < 44.6:
                add(M, bar + off, hat(), 0.11 if k % 2 == 0 else 0.06)
        bar += 4 * beat

    # --- events
    for t0 in BLIP_T:
        add(M, t0, blip(), 0.22)
    add(M, 5.85, rumble(), 0.55)
    for t0 in WHOOSH_T:
        add(M, t0 - 0.18, whoosh(), 0.24)
    for t0 in QUINDAR_T:
        add(M, t0, quindar(), 0.14)
    for t0 in (20.6, 21.15, 21.7):
        add(M, t0, alarm_buzz(), 0.5)
    # radio bed under the descent + tv broadcast
    for a, bnd in ((19.4, 25.2), (27.0, 30.5)):
        sn = RNG.normal(0, 1, _n(bnd - a)).astype(np.float32)
        sn = np.convolve(sn, np.ones(6, np.float32) / 6, "same")
        add(M, a, sn, 0.035)
    add(M, 25.05, kick(deep=True), 0.7)       # touchdown thud
    add(M, 31.8, riser(), 0.5)
    add(M, 33.0, kick(deep=True), 0.9)        # the leap hits
    for t0 in LEAP_HITS[1:]:
        add(M, t0, kick(), 0.5)
    crash = RNG.normal(0, 1, _n(1.2)).astype(np.float32)
    add(M, 33.0, np.diff(crash, prepend=0) * env_ad(1.2, 0.004, 5), 0.30)
    for t0 in POP_T:
        add(M, t0, thunk(), 0.30)
    for i in range(len(QUOTE_WORDS)):
        add(M, QUOTE_T0 + i * QUOTE_DT, thunk(140), 0.2)
    for t0, cnt in ((OUTRO_LINE1_T, OUTRO_LINE1_N), (OUTRO_LINE2_T, OUTRO_LINE2_N)):
        for j in range(cnt):
            add(M, t0 + j * 0.25, thunk(120), 0.2)
    for text, t0, cps in TYPED:
        for j in range(len(text)):
            if text[j] != " ":
                add(M, t0 + j / cps, click(), 0.16)

    # --- mix
    L = padL + M + crackle
    R = padR + M + crackle
    mast = gain_env(total, [(0, 1), (51.2, 1), (52.3, 0.0), (total, 0)])
    L *= mast
    R *= mast
    L = np.tanh(L * 1.25)
    R = np.tanh(R * 1.25)
    peak = max(np.abs(L).max(), np.abs(R).max(), 1e-6)
    L *= 0.89 / peak
    R *= 0.89 / peak
    data = np.empty(n * 2, np.float32)
    data[0::2], data[1::2] = L, R
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((data * 32767).astype("<i2").tobytes())
    return path


if __name__ == "__main__":
    from config import OUT
    OUT.mkdir(exist_ok=True)
    print(build(OUT / "soundtrack.wav"))
