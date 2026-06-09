"""Render "the first man on the moon — riza style".

  python render.py            full 1080p30 render with soundtrack
  python render.py --stills   dump keyframes + contact sheets for review
  python render.py --draft    fast 540p15 pass
"""
import math
import subprocess
import sys
import time
from bisect import bisect_right

import numpy as np
from PIL import Image

import audio
from config import FPS, H, OUT, T_END, W
from fx import camera, film, light_leak, shake, smooth
from scenes import SCENES

STARTS = [s[0] for s in SCENES]


def render_frame(t, f):
    i = bisect_right(STARTS, t) - 1
    tl = t - STARTS[i]
    canvas = Image.new("RGBA", (W, H))
    cam = SCENES[i][1](tl, t, f, canvas)
    leak = cam.get("leak", 0)
    if leak > 0:
        x = int(-250 + 320 * math.sin(t * 0.21 + i))
        canvas.alpha_composite(_scaled_leak(leak), (x, -300))
    dx, dy, rot = shake(t, cam.get("amp", 0), cam.get("rough", 0), f)
    img = camera(canvas, cam.get("zoom", 1.0), dx, dy, rot)
    fade = smooth((t - 51.3) / 1.2) if t > 51.3 else 0.0
    return film(img, f, grain=cam.get("grain", 7), fade=fade)


_leak_cache = {}


def _scaled_leak(amount):
    key = round(amount, 2)
    if key not in _leak_cache:
        base = light_leak().copy()
        a = base.getchannel("A").point(lambda v: int(v * amount))
        base.putalpha(a)
        _leak_cache[key] = base
    return _leak_cache[key]


def stills():
    OUT.mkdir(exist_ok=True)
    times = [1.2, 3.7, 4.5, 6.0, 7.6, 9.3, 12.6, 15.4, 18.1, 21.4, 23.9, 25.9,
             28.6, 31.9, 34.3, 37.6, 40.6, 43.6, 47.2, 50.9]
    thumbs = []
    for tt in times:
        img = render_frame(tt, int(tt * FPS))
        p = OUT / f"still_{tt:05.1f}.png"
        img.save(p)
        thumbs.append((tt, img.resize((W // 3, H // 3), Image.Resampling.BILINEAR)))
        print("still", tt)
    for sheet_i in range(2):
        grid = Image.new("RGB", (W // 3 * 4 + 50, H // 3 * 3 + 40), (30, 30, 30))
        for k, (tt, th) in enumerate(thumbs[sheet_i * 10:(sheet_i + 1) * 10]):
            x = (k % 4) * (W // 3 + 10) + 10
            y = (k // 4) * (H // 3 + 10) + 10
            grid.paste(th, (x, y))
        grid.save(OUT / f"sheet{sheet_i + 1}.png")
    print("sheets written")


def main():
    draft = "--draft" in sys.argv
    OUT.mkdir(exist_ok=True)
    wav = OUT / "soundtrack.wav"
    print("synthesizing soundtrack…")
    audio.build(wav)

    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    fps = 15 if draft else FPS
    ow, oh = (960, 540) if draft else (W, H)
    out_path = OUT / ("draft.mp4" if draft else "first_man_on_the_moon_riza_style.mp4")
    cmd = [ffmpeg, "-y",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{ow}x{oh}",
           "-r", str(fps), "-i", "pipe:0",
           "-i", str(wav),
           "-c:v", "libx264", "-preset", "medium", "-crf", "27" if draft else "21",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
           "-shortest", "-movflags", "+faststart", str(out_path)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    n_frames = int(T_END * fps)
    t_start = time.time()
    try:
        for f in range(n_frames):
            t = f / fps
            img = render_frame(t, int(t * FPS))
            if draft:
                img = img.resize((ow, oh), Image.Resampling.BILINEAR)
            proc.stdin.write(np.asarray(img, dtype=np.uint8).tobytes())
            if f % (fps * 5) == 0:
                el = time.time() - t_start
                print(f"frame {f}/{n_frames}  t={t:5.1f}s  elapsed={el:5.1f}s",
                      flush=True)
        proc.stdin.close()
        proc.wait()
    except BrokenPipeError:
        print(proc.stderr.read().decode()[-3000:])
        raise
    if proc.returncode:
        print(proc.stderr.read().decode()[-3000:])
        sys.exit(1)
    print(f"done in {time.time() - t_start:.0f}s → {out_path}")


if __name__ == "__main__":
    if "--stills" in sys.argv:
        stills()
    else:
        main()
