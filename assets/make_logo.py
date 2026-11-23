"""UNO asl logotipidan uchta haykal, UNO yozuvi va samolyotni olib, vektor (SVG) qizil belgini yasaydi.

Haykallar va samolyot asl rasmdan silliqlanib vektorga aylantiriladi,
UNO harflari esa toza serif shrift bilan qayta chiziladi (asl joylashuvida).

Ishlatish:
    pip install potracer fonttools pillow numpy
    python3 assets/make_logo.py            # icon.svg ni yasaydi
    node assets/render_icons.js            # icon.svg dan PNG belgilarni yasaydi (Playwright)
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import potrace
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONT = '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'
UP = 3                       # aniqlik uchun rasmni 3 marta kattalashtirib ishlaymiz
BOX = (330, 350, 750, 720)   # asl rasmdagi markaziy qism: haykallar + samolyot
PLANE_Y = 628                # shu chiziqdan pastda samolyot (asl rasm koordinatasi)
LETTER_BAND = (522, 624)     # UNO harflari joylashgan qator (asl rasm koordinatasi)


def to_img(arr):
    return Image.fromarray((arr * 255).astype('uint8')).copy()


def blur_bin(arr, sigma, thr=128):
    return np.array(to_img(arr).filter(ImageFilter.GaussianBlur(sigma))) > thr


def fill_holes(arr):
    padded = to_img(np.pad(arr, 2))
    ImageDraw.floodfill(padded, (0, 0), 128)
    outside = np.array(padded) == 128
    return ~outside[2:-2, 2:-2]


# ---------- 1) Asl rasmdan oltin shaklni ajratish ----------
src = Image.open(os.path.join(HERE, 'uno-original.png')).convert('RGBA').crop(BOX)
src = src.resize((src.width * UP, src.height * UP), Image.LANCZOS)
a = np.array(src).astype(float)
alpha = a[..., 3:4] / 255
rgb = a[..., :3] * alpha + 255 * (1 - alpha)
score = np.maximum((rgb.max(axis=2) - rgb.min(axis=2)) * 1.2, 255 - rgb.mean(axis=2))

h, w = score.shape
yy, xx = np.mgrid[0:h, 0:w]
cx, cy = (540 - BOX[0]) * UP, (540 - BOX[1]) * UP
inside = (xx - cx) ** 2 + (yy - cy) ** 2 < (245 * UP) ** 2

shape = blur_bin(score * inside / 255, UP * 0.8, 40)
body = np.array(to_img((score > 6) & inside).filter(ImageFilter.MinFilter(UP * 2 + 1))) > 0
shape |= body

# Faqat asosiy bo'laklar (haykallar, samolyot, dvigatellar); mayda nuqtalar tashlanadi
label = to_img(shape)
SEEDS = [(430, 420), (540, 420), (650, 420), (540, 690), (380, 662), (700, 662), (475, 684), (605, 684)]
for sx, sy in SEEDS:
    px, py = (sx - BOX[0]) * UP, (sy - BOX[1]) * UP
    for r in range(40):
        hit = next(((px + dx, py + dy) for dx, dy in ((r, 0), (-r, 0), (0, r), (0, -r), (r, r), (-r, -r))
                    if label.getpixel((px + dx, py + dy)) == 255), None)
        if hit:
            ImageDraw.floodfill(label, hit, 128)
            break
shape = np.array(label) == 128

# ---------- 2) Harflar joyini aniqlash (haykal ichidagi teshiklar) ----------
filled = fill_holes(shape)
holes = filled & ~shape
b0, b1 = (LETTER_BAND[0] - BOX[1]) * UP, (LETTER_BAND[1] - BOX[1]) * UP
band = np.zeros_like(holes)
band[b0:b1] = holes[b0:b1]
cols = band.sum(axis=0) > UP * 6
runs, start = [], None
for x in range(len(cols) + 1):
    on = x < len(cols) and cols[x]
    if on and start is None:
        start = x
    elif not on and start is not None:
        runs.append((start, x - 1)); start = None
runs = sorted(sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:3])
letter_boxes = []
for x0, x1 in runs:
    ys_ = np.nonzero(band[:, x0:x1 + 1].any(axis=1))[0]
    letter_boxes.append((x0, ys_.min(), x1, ys_.max()))

# ---------- 3) Silliq haykallar (teshiklarsiz) + samolyot ----------
py0 = (PLANE_Y - BOX[1]) * UP
figures = filled.copy(); figures[py0:] = False
figures = fill_holes(blur_bin(figures, UP * 2.6))
plane = shape.copy(); plane[:py0] = False
plane = blur_bin(plane, UP * 0.9)
final = figures | plane

ys, xs = np.nonzero(final)
ox, oy = xs.min(), ys.min()
final = final[oy:ys.max() + 1, ox:xs.max() + 1]
H, W = final.shape
PAD = 8
final = np.pad(final, PAD)

# ---------- 4) Vektorga aylantirish ----------
plist = potrace.Bitmap(~final).trace(turdsize=int(10 * UP * UP), alphamax=1.2, opticurve=True, opttolerance=0.3)


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


d = []
for curve in plist:
    sp = curve.start_point
    d.append(f'M{f(sp.x)} {f(sp.y)}')
    for seg in curve.segments:
        if seg.is_corner:
            d.append(f'L{f(seg.c.x)} {f(seg.c.y)}L{f(seg.end_point.x)} {f(seg.end_point.y)}')
        else:
            d.append(f'C{f(seg.c1.x)} {f(seg.c1.y)} {f(seg.c2.x)} {f(seg.c2.y)} {f(seg.end_point.x)} {f(seg.end_point.y)}')
    d.append('Z')
figure_d = ''.join(d)

# ---------- 5) UNO harflari shriftdan ----------
font = TTFont(FONT)
gs = font.getGlyphSet()
cmap = font.getBestCmap()
cap = font['OS/2'].sCapHeight or 1341


def glyph_path(ch, box):
    """Harfni box (bitmap koordinatasi, PAD qo'shilgan) ichiga joylaydi."""
    x0, y0, x1, y1 = box
    name = cmap[ord(ch)]
    g = gs[name]
    k = (y1 - y0) / cap
    gw = g.width * k
    # glif o'rtasini box o'rtasiga qo'yamiz; shrift koordinatasida y yuqoriga o'sadi
    lsb = font['hmtx'][name][1]
    bounds_w = (font['glyf'][name].xMax - font['glyf'][name].xMin) * k if 'glyf' in font else gw
    tx = (x0 + x1) / 2 - bounds_w / 2 - lsb * k
    pen = SVGPathPen(gs, ntos=lambda v: f(v))
    g.draw(TransformPen(pen, (k, 0, 0, -k, tx, y1)))
    return pen.getCommands()


letters_d = ''.join(glyph_path(ch, (bx0 - ox + PAD, by0 - oy + PAD, bx1 - ox + PAD, by1 - oy + PAD))
                    for ch, (bx0, by0, bx1, by1) in zip('UNO', letter_boxes))

# ---------- 6) Qizil belgi ----------
S = 512
scale = min(S * 0.80 / W, S * 0.74 / H)
tx = (S - W * scale) / 2 - PAD * scale
ty = (S - H * scale) / 2 + S * 0.01 - PAD * scale
T = f'translate({f(tx)} {f(ty)}) scale({scale:.5f})'

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">
  <defs>
    <linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="{S}" y2="{S}">
      <stop offset="0" stop-color="#ff4646"/>
      <stop offset="1" stop-color="#cd0012"/>
    </linearGradient>
    <mask id="letters" maskUnits="userSpaceOnUse" x="0" y="0" width="{S}" height="{S}">
      <rect width="{S}" height="{S}" fill="#fff"/>
      <path transform="{T}" fill="#000" d="{letters_d}"/>
    </mask>
    <filter id="sh" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#5a0000" flood-opacity=".35"/>
    </filter>
  </defs>
  <rect width="{S}" height="{S}" rx="116" fill="url(#bg)"/>
  <g filter="url(#sh)">
    <g mask="url(#letters)">
      <path transform="{T}" fill="#fff" fill-rule="evenodd" d="{figure_d}"/>
    </g>
  </g>
</svg>
'''
with open(os.path.join(ROOT, 'icon.svg'), 'w') as fh:
    fh.write(svg)
print('icon.svg tayyor:', len(plist), 'ta kontur, harflar:', letter_boxes, round(len(svg) / 1024), 'KB')
