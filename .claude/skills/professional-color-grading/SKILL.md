---
name: professional-color-grading
description: Color-correct and grade video with FFmpeg - exposure/white-balance fixes, contrast curves, teal-orange and film looks, 3D LUTs (.cube), log-to-Rec.709 conversion, and shot matching. Use when the user asks to color grade, color correct, apply a LUT, fix white balance, make footage look cinematic/filmic, or match colors between clips.
---

# Professional Color Grading

Grade video with FFmpeg's built-in filters. FFmpeg is the only hard requirement; everything else is optional.

## 0. Preflight

```bash
command -v ffmpeg ffprobe || { echo "FFmpeg missing - ask the user before installing (apt-get install ffmpeg)"; exit 1; }
ffmpeg -hide_banner -filters | grep -E ' (eq|curves|colorbalance|colortemperature|lut3d|zscale|vibrance|selectivecolor) '
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,pix_fmt,width,height,r_frame_rate,color_space,color_transfer,color_primaries,bits_per_raw_sample \
  -of default=nw=1 "$IN"
```

Read the probe output before grading:
- `color_transfer` of `arib-std-b67` / `smpte2084` means HDR (HLG/PQ) - tone-map first (section 4).
- 10-bit sources (`yuv420p10le`, `bits_per_raw_sample=10`) - keep 10-bit through the chain (`format=yuv420p10le`) and encode with `libx265 -pix_fmt yuv420p10le` to avoid banding.
- Footage that looks flat/grey with low saturation is probably log (S-Log3, V-Log, C-Log, LogC) - ask which camera, then use a LUT (section 3).

## 1. Workflow (always in this order)

1. **Correct** - neutralise first: exposure, white balance, contrast. Use the scopes (section 6).
2. **Grade** - apply the creative look.
3. **Finish** - saturation trim, optional grain/vignette, output colour tags.

Always render a **10-second preview** first and extract stills for the user to compare:

```bash
ffmpeg -y -ss 00:00:05 -t 10 -i "$IN" -vf "$VF" -c:v libx264 -crf 18 -preset fast -c:a copy preview.mp4
ffmpeg -y -ss 00:00:08 -i "$IN" -frames:v 1 before.png
ffmpeg -y -ss 00:00:08 -i "$IN" -vf "$VF" -frames:v 1 after.png
ffmpeg -y -i before.png -i after.png -filter_complex hstack compare.png
```

Never overwrite the source. Write to a new file such as `name_graded.mp4`.

## 2. Primary correction

| Problem | Filter |
|---|---|
| Too dark / bright | `eq=brightness=0.04` (range -1..1; keep within ±0.1) or `curves=master='0/0 0.5/0.58 1/1'` |
| Flat contrast | `eq=contrast=1.1` or an S-curve: `curves=master='0/0 0.25/0.20 0.75/0.82 1/1'` |
| Too warm / cool | `colortemperature=temperature=7500` cools a too-warm shot; `=5000` warms a too-cool one (6500 = neutral; lower = warmer) |
| Colour cast | `colorbalance=rm=-0.05:gm=0:bm=0.05` (s/m/h = shadows/mids/highlights) |
| Dull colour | `vibrance=intensity=0.15` (protects skin better than raw saturation) |
| Crushed / clipped | `curves=master='0/0.03 1/0.97'` (lift blacks / roll highlights) |

Gamma: `eq=gamma=1.1`. Avoid stacking several `eq` filters; combine into one.

## 3. LUTs (.cube / .3dl)

```bash
# Creative or technical LUT; interp=tetrahedral is the most accurate
ffmpeg -i "$IN" -vf "lut3d=file='look.cube':interp=tetrahedral" -c:v libx264 -crf 17 -c:a copy out.mp4

# Blend a LUT at 60% strength
ffmpeg -i "$IN" -filter_complex \
 "[0:v]split[a][b];[b]lut3d=file='look.cube'[g];[a][g]blend=all_mode=normal:all_opacity=0.6,format=yuv420p" \
 -c:v libx264 -crf 17 -c:a copy out.mp4
```

Log footage: apply the **manufacturer's official log-to-Rec.709 LUT** (Sony, Panasonic, Canon, ARRI, Blackmagic each publish them free on their own websites). Do correction **before** a creative LUT and **after** a technical (log→709) LUT. Ask the user for the LUT file; do not download LUTs from random sites.

Generating a LUT programmatically: write a `.cube` file (header `LUT_3D_SIZE 33`, then 33³ lines of `R G B` floats, red changing fastest). `colour-science` can read/write/convert LUT formats if the user already has it.

## 4. HDR → SDR tone mapping

```bash
ffmpeg -i "$IN" -vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p" \
  -c:v libx264 -crf 18 -c:a copy sdr.mp4
```

This relies on the file's colour tags. If it fails with "Generic error in an external library", the tags are missing: state them in the first zscale, e.g. `zscale=tin=smpte2084:min=bt2020nc:pin=bt2020:t=linear:npl=100` for PQ (use `tin=arib-std-b67` for HLG).

## 5. Look presets (starting points - tune to the footage)

```bash
# Teal & orange (blockbuster)
VF="colorbalance=rs=-0.08:gs=0.02:bs=0.10:rh=0.08:gh=0.02:bh=-0.08,curves=master='0/0 0.25/0.21 0.75/0.80 1/1',vibrance=intensity=0.12"

# Warm film / golden hour
VF="colortemperature=temperature=5200,curves=r='0/0.04 0.5/0.54 1/1':b='0/0 0.5/0.46 1/0.94',eq=saturation=1.05"

# Faded / matte film (lifted blacks + grain)
VF="curves=master='0/0.07 0.5/0.5 1/0.95',eq=saturation=0.88,noise=alls=6:allf=t"

# Cold thriller
VF="colortemperature=temperature=8000,colorbalance=bs=0.06,eq=contrast=1.08:saturation=0.85"

# Clean commercial / bright
VF="eq=contrast=1.05:brightness=0.02:saturation=1.08,unsharp=5:5:0.4"

# Black & white with contrast
VF="hue=s=0,curves=master='0/0 0.3/0.22 0.7/0.80 1/1'"

# Vignette finishing touch (append to any look)
VF="$VF,vignette=PI/5"
```

## 6. Scopes (measure, don't guess)

```bash
# Waveform + vectorscope + histogram montage of one frame
ffmpeg -y -ss 5 -i "$IN" -frames:v 1 -filter_complex \
 "[0:v]split=3[a][b][c];[a]waveform=g=green:fl=numbers,scale=640:360[w];[b]vectorscope=m=color3:g=green,scale=360:360[v];[c]histogram,scale=640:360[h];[w][v][h]hstack=3" scopes.png
```

Read the PNG with the Read tool. Skin tones should sit on the vectorscope's skin line (≈ 11 o'clock); the waveform should span roughly 5–95% without clipping.

Matching two clips: grab scopes from both, then adjust `colorbalance`/`curves` on clip B until the waveform and vectorscope distributions match clip A.

## 7. Encoding

- Delivery: `-c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -movflags +faststart`
- 10-bit master: `-c:v libx265 -crf 18 -pix_fmt yuv420p10le -tag:v hvc1`
- Mezzanine for further editing: `-c:v prores_ks -profile:v 3`
- Tag output colour so players don't shift it: `-colorspace bt709 -color_primaries bt709 -color_trc bt709`
- Copy audio unchanged with `-c:a copy`.

## Open-source references (reviewed)

| Project | License | Notes |
|---|---|---|
| [FFmpeg](https://github.com/FFmpeg/FFmpeg) | LGPL-2.1+ / GPL-2+ (this build: GPL) | Core tool. Use the distro package. |
| [OpenColorIO](https://github.com/AcademySoftwareFoundation/OpenColorIO) | BSD-3-Clause | ASWF industry standard for colour pipelines/ACES. Optional, `pip install opencolorio`. |
| [colour-science/colour](https://github.com/colour-science/colour) | BSD-3-Clause | Python colour maths, LUT I/O. Optional, `pip install colour-science`. |

Security: install only from the official package index or distro packages, pin versions, and never execute LUTs or "preset packs" that ship scripts. `.cube` files are plain text - inspect before use.
