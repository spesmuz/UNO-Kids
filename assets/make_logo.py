"""UNO asl logotipidan uchta haykal va UNO yozuvini ajratib, qizil ilova belgisini yasaydi.
Ishlatish: python3 assets/make_logo.py  (Pillow va numpy kerak)"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CUT_Y = 627  # shu chiziqdan pasti (samolyot) olinmaydi

im = Image.open(os.path.join(HERE, 'uno-original.png')).convert('RGBA')
a = np.array(im).astype(float)
alpha = a[..., 3:4] / 255
rgb = a[..., :3] * alpha + 255 * (1 - alpha)
sat = rgb.max(axis=2) - rgb.min(axis=2)
dark = 255 - rgb.mean(axis=2)
score = np.maximum(sat * 1.2, dark)

h, w = score.shape
yy, xx = np.mgrid[0:h, 0:w]
inside = ((xx - 540) ** 2 + (yy - 540) ** 2 < 245 ** 2) & (yy < CUT_Y)
soft = np.clip((score - 20) / 18, 0, 1) * inside

mask = Image.fromarray((soft * 255).astype('uint8'))
# Faqat asosiy (eng katta) bo'lakni qoldiramiz: mayda nuqtalar tozalanadi
binm = mask.point(lambda v: 255 if v > 140 else 0)
ys, xs = np.nonzero(np.array(binm))
seed = (int(np.median(xs)), int(np.percentile(ys, 70)))
while binm.getpixel(seed) != 255:
    seed = (seed[0], seed[1] + 1)
ImageDraw.floodfill(binm, seed, 128)
keep = np.array(binm) == 128
keep_img = Image.fromarray((keep * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))
keep_arr = np.array(keep_img) > 0
# Ichki och-oltin joylar (yaltirash) ham to'liq oq bo'lsin: past chegara bilan tana, chetidan 2px ichkarida
mask_arr = np.array(mask).astype(float)
body = Image.fromarray(((score > 6) & inside).astype('uint8') * 255).filter(ImageFilter.MinFilter(5))
mask_arr = np.maximum(mask_arr, np.array(body).astype(float)) * keep_arr
mask = Image.fromarray(mask_arr.astype('uint8'))
bbox = mask.point(lambda v: 255 if v > 128 else 0).getbbox()
mask = mask.crop(bbox)
mask.save(os.path.join(HERE, 'uno-figures-mask.png'))

def red_bg(size):
    s = size
    g = np.zeros((s, s, 4), dtype=np.uint8)
    t = (np.add.outer(np.arange(s), np.arange(s)) / (2 * s - 2))[..., None]
    c1, c2 = np.array([255, 70, 70]), np.array([205, 0, 18])
    g[..., :3] = (c1 * (1 - t) + c2 * t).astype(np.uint8)
    g[..., 3] = 255
    bg = Image.fromarray(g, 'RGBA')
    m = Image.new('L', (s, s), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.226), fill=255)
    bg.putalpha(m)
    return bg

def make_icon(size, out):
    big = size * 4  # silliq chet uchun katta o'lchamda chizib, keyin kichraytiramiz
    bg = red_bg(big)
    mw, mh = mask.size
    scale = min(big * 0.80 / mw, big * 0.74 / mh)
    fm = mask.resize((int(mw * scale), int(mh * scale)), Image.LANCZOS)
    x = (big - fm.width) // 2
    y = (big - fm.height) // 2 + int(big * 0.02)
    # yengil soya
    shadow = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    sh = Image.new('RGBA', fm.size, (90, 0, 0, 110)); sh.putalpha(fm.point(lambda v: v * 110 // 255))
    shadow.paste(sh, (x, y + big // 80), sh)
    shadow = shadow.filter(ImageFilter.GaussianBlur(big / 120))
    bg = Image.alpha_composite(bg, shadow)
    white = Image.new('RGBA', fm.size, (255, 255, 255, 255)); white.putalpha(fm)
    bg.alpha_composite(white, (x, y))
    bg.resize((size, size), Image.LANCZOS).save(out)

for s in (180, 192, 512, 1024):
    make_icon(s, os.path.join(ROOT, f'icon-{s}.png'))

print('tayyor', mask.size)
